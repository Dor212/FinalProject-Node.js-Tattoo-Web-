import express from "express";
import multer from "multer";
import Product from "../models/product.schema.js";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

// ----- Cloudinary -----
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "merchendise",
    allowed_formats: ["jpeg", "jpg", "png"],
    public_id: (req, file) => `${Date.now()}-${file.originalname}`,
  },
});
const upload = multer({ storage });

const toInt = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
};

// תמיכה לאחור + נורמליזציה למידות L/XL/XXL
function normalizeStockFromBody(body) {
  const stockL = body.stockL ?? body.l ?? body.stockSmall ?? body.small;
  const stockXL = body.stockXL ?? body.xl ?? body.stockMedium ?? body.medium;
  const stockXXL = body.stockXXL ?? body.xxl ?? body.stockLarge ?? body.large;

  const stock = {};
  if (stockL !== undefined && stockL !== "") {
    const v = toInt(stockL);
    stock.l = { initial: v, current: v };
  }
  if (stockXL !== undefined && stockXL !== "") {
    const v = toInt(stockXL);
    stock.xl = { initial: v, current: v };
  }
  if (stockXXL !== undefined && stockXXL !== "") {
    const v = toInt(stockXXL);
    stock.xxl = { initial: v, current: v };
  }

  return Object.keys(stock).length ? stock : null;
}

// ============================ ROUTES ============================


router.get("/", async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    console.error("❌ SERVER ERROR:", err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

router.post("/upload", upload.single("image"), async (req, res) => {
  try {
    const { title, price, description } = req.body;

    if (!req.file) return res.status(400).json({ error: "Image required" });
    if (!title) return res.status(400).json({ error: "Title is required" });
    if (price === undefined || price === null || price === "")
      return res.status(400).json({ error: "Price is required" });

    const stock = normalizeStockFromBody(req.body);

    const base = {
      title: String(title).trim(),
      price: toInt(price),
      imageUrl: req.file.path,
    };
    if (typeof description === "string" && description.trim() !== "") {
      base.description = description.trim();
    }

    if (stock) base.stock = stock;

    const newProduct = new Product(base);
    await newProduct.save();
    res.status(201).json(newProduct);
  } catch (err) {
    console.error("❌ SERVER ERROR:", err);
    res.status(500).json({
      error: "Failed to upload product",
      details: err?.message || "Unknown error",
    });
  }
});


router.post("/purchase", async (req, res) => {
  const { productId, quantities = {} } = req.body;
  try {
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ error: "Product not found" });
    if (!product.stock) {
      return res
        .status(400)
        .json({ error: "This product has no size-based stock" });
    }

    const q = {
      l: toInt(quantities.l ?? quantities.small ?? 0),
      xl: toInt(quantities.xl ?? quantities.medium ?? 0),
      xxl: toInt(quantities.xxl ?? quantities.large ?? 0),
    };

    if (q.l && product.stock.l)
      product.stock.l.current = Math.max(0, product.stock.l.current - q.l);
    if (q.xl && product.stock.xl)
      product.stock.xl.current = Math.max(0, product.stock.xl.current - q.xl);
    if (q.xxl && product.stock.xxl)
      product.stock.xxl.current = Math.max(
        0,
        product.stock.xxl.current - q.xxl
      );

    await product.save();
    res.json({ message: "Purchase successful", product });
  } catch (err) {
    console.error("❌ PURCHASE ERROR:", err);
    res.status(500).json({ error: "Failed to update stock" });
  }
});


router.patch("/:id/stock", async (req, res) => {
  const toIntLocal = (v) =>
    v !== undefined && v !== null && v !== "" && !isNaN(v)
      ? parseInt(v, 10)
      : null;
  const mapLegacy = (k) =>
    k === "small" ? "l" : k === "medium" ? "xl" : k === "large" ? "xxl" : k;

  try {
    const { id } = req.params;
    const { action, sizes = {}, createStockIfMissing = false } = req.body || {};
    const allowed = ["set", "add", "subtract", "reset", "remove"];
    if (!allowed.includes(action)) {
      return res.status(400).json({ error: "Invalid action" });
    }

    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ error: "Product not found" });

    if (!product.stock && !createStockIfMissing) {
      return res.status(400).json({
        error: "No stock exists. Use createStockIfMissing=true to create.",
      });
    }
    if (!product.stock) product.stock = {};

    for (const key of Object.keys(sizes)) {
      const size = mapLegacy(key);
      const payload = sizes[key] || {};
      if (!["l", "xl", "xxl"].includes(size)) continue;

      if (action === "set") {
        if (!product.stock[size])
          product.stock[size] = { initial: 0, current: 0 };
        const init = toIntLocal(payload.initial);
        const curr = toIntLocal(payload.current);
        if (init !== null) product.stock[size].initial = Math.max(0, init);
        if (curr !== null) product.stock[size].current = Math.max(0, curr);
        if (init !== null && curr === null) {
          product.stock[size].current = product.stock[size].initial;
        }
      }

      if (action === "add") {
        const delta = toIntLocal(payload.delta);
        if (delta) {
          if (!product.stock[size])
            product.stock[size] = { initial: 0, current: 0 };
          product.stock[size].current += delta;
        }
      }

      if (action === "subtract") {
        const delta = toIntLocal(payload.delta);
        if (delta) {
          if (!product.stock[size])
            product.stock[size] = { initial: 0, current: 0 };
          product.stock[size].current = Math.max(
            0,
            product.stock[size].current - delta
          );
        }
      }

      if (action === "reset") {
        if (!product.stock[size])
          product.stock[size] = { initial: 0, current: 0 };
        const init = toIntLocal(payload.initial);
        if (init !== null) product.stock[size].initial = Math.max(0, init);
        product.stock[size].current = product.stock[size].initial;
      }

      if (action === "remove") {
        delete product.stock[size];
      }
    }

    if (Object.keys(product.stock).length === 0) product.stock = undefined;

    await product.save();
    res.json({ message: "Stock updated", product });
  } catch (err) {
    console.error("❌ PATCH STOCK ERROR:", err);
    res
      .status(500)
      .json({ error: "Failed to update stock", details: err?.message });
  }
});


router.delete("/:id", async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });

    const imageUrl = product.imageUrl;
    const publicId = imageUrl
      .split("/")
      .slice(-2)
      .join("/")
      .replace(/\.[^/.]+$/, "");
    await cloudinary.uploader.destroy(publicId);

    res.json({ message: "Product and image deleted from Cloudinary" });
  } catch (err) {
    console.error("❌ DELETE ERROR:", err);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

export default router;
