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
    folder: "merchendise", // שם תיקייה ב-Cloudinary
    allowed_formats: ["jpeg", "jpg", "png"],
    public_id: (req, file) => `${Date.now()}-${file.originalname}`,
  },
});

const upload = multer({ storage });

// 🔽 GET – כל המוצרים
router.get("/", async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    console.error("❌ SERVER ERROR:", err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// ⬆️ POST – העלאת מוצר חדש
router.post("/upload", upload.single("image"), async (req, res) => {
  try {
    const { title, price, stockSmall, stockMedium, stockLarge } = req.body;

    if (!req.file) return res.status(400).json({ error: "Image required" });

    const newProduct = new Product({
      title,
      price,
      imageUrl: req.file.path, // Cloudinary URL
      stock: {
        small: parseInt(stockSmall) || 0,
        medium: parseInt(stockMedium) || 0,
        large: parseInt(stockLarge) || 0,
      },
    });

    await newProduct.save();
    res.status(201).json(newProduct);
  } catch (err) {
    console.log("❌ SERVER ERROR:");
    console.dir(err, { depth: null }); // ✅ יציג שגיאה גם אם היא לא serializable
    res.status(500).json({
      error: "Failed to upload product",
      details: err?.message || "Unknown error",
    });
  }
});

// ❌ DELETE – מחיקת מוצר
router.delete("/:id", async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (product) {
      const imagePath = path.join(uploadPath, path.basename(product.imageUrl));
      if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
      res.json({ message: "Product deleted" });
    } else {
      res.status(404).json({ error: "Product not found" });
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to delete product" });
  }
});

export default router;
