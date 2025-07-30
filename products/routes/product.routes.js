import express from "express";
import multer from "multer";
import Product from "../models/product.schema.js";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

// הגדרת Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// הגדרת אחסון ב-Cloudinary
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "merchendise", 
    allowed_formats: ["jpeg", "jpg", "png"],
    public_id: (req, file) => `${Date.now()}-${file.originalname}`,
  },
});

const upload = multer({ storage });


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
    const { title, price, stockSmall, stockMedium, stockLarge, stockXL } =
      req.body;

    if (!req.file) return res.status(400).json({ error: "Image required" });

    const newProduct = new Product({
      title,
      price,
      imageUrl: req.file.path,
      stock: {
        small: {
          initial: parseInt(stockSmall) || 0,
          current: parseInt(stockSmall) || 0,
        },
        medium: {
          initial: parseInt(stockMedium) || 0,
          current: parseInt(stockMedium) || 0,
        },
        large: {
          initial: parseInt(stockLarge) || 0,
          current: parseInt(stockLarge) || 0,
        },
      },
    });

    await newProduct.save();
    res.status(201).json(newProduct);
  } catch (err) {
    console.log("❌ SERVER ERROR:");
    console.dir(err, { depth: null }); 
    res.status(500).json({
      error: "Failed to upload product",
      details: err?.message || "Unknown error",
    });
  }
});
//עדכון המלאי ברכישה
router.post("/purchase", async (req, res) => {
  const { productId, quantities } = req.body;

  try {
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ error: "Product not found" });


    if (quantities.small)
      product.stock.small.current = Math.max(
        0,
        product.stock.small.current - quantities.small
      );
    if (quantities.medium)
      product.stock.medium.current = Math.max(
        0,
        product.stock.medium.current - quantities.medium
      );
    if (quantities.large)
      product.stock.large.current = Math.max(
        0,
        product.stock.large.current - quantities.large
      );

    await product.save();

    res.json({ message: "Purchase successful", product });
  } catch (err) {
    res.status(500).json({ error: "Failed to update stock" });
  }
});


// ❌ DELETE – מחיקת מוצר
router.delete("/:id", async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // הוצאת public_id מתוך imageUrl
    const imageUrl = product.imageUrl;
    const publicId = imageUrl
      .split("/")
      .slice(-2)
      .join("/")
      .replace(/\.[^/.]+$/, ""); // הסר סיומת

    // נסה למחוק מה־Cloudinary
    await cloudinary.uploader.destroy(publicId);

    res.json({ message: "Product and image deleted from Cloudinary" });
  } catch (err) {
    console.error("❌ DELETE ERROR:", err);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

export default router;
