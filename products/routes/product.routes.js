import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import Product from "../models/product.schema.js";
import { fileURLToPath } from "url";
import { nanoid } from "nanoid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// שינוי הנתיב לתוך תקיית merchendise
const uploadPath = path.join(__dirname, "../../public/merchendise");

if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadPath),
  filename: (_, file, cb) => {
    const fileExt = path.extname(file.originalname); 
    const randomName = nanoid(12); 
    const unique = `<span class="math-inline">\{Date\.now\(\)\}\-</span>{randomName}${fileExt}`; // שם חדש: timestamp-randomstring.ext
    cb(null, unique);
  },
});

const upload = multer({ storage });

// 🔽 GET – כל המוצרים
router.get("/", async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
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
      imageUrl: `/merchendise/${req.file.filename}`,
      stock: {
        small: parseInt(stockSmall) || 0,
        medium: parseInt(stockMedium) || 0,
        large: parseInt(stockLarge) || 0,
      },
    });

    await newProduct.save();
    res.status(201).json(newProduct);
  } catch (err) {
    res.status(500).json({ error: "Failed to upload product" });
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
