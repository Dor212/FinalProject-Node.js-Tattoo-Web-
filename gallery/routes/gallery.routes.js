import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";
import { promises as fsp } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// 🗂️ מיקום תיקיית הסקיצות בתוך public
const baseGalleryPath = path.join(__dirname, "../../public/sketchesTattoo");

// 🛠️ הגדרת multer להעלאת תמונות לפי קטגוריה
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const category = req.params.category;
    const categoryPath = path.join(baseGalleryPath, category);
    if (!fs.existsSync(categoryPath)) {
      fs.mkdirSync(categoryPath, { recursive: true });
    }
    cb(null, categoryPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname.replace(
      /\s+/g,
      "_"
    )}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// 🔽 GET /gallery/:category - מחזיר את כל הקבצים לפי קטגוריה
router.get("/:category", (req, res) => {
  const { category } = req.params;
  const categoryPath = path.join(baseGalleryPath, category);

  if (!fs.existsSync(categoryPath)) {
    return res.json([]);
  }

  const files = fs.readdirSync(categoryPath);
  const urls = files.map((file) => `/sketchesTattoo/${category}/${file}`);
  res.json(urls);
});

// ⬆️ POST /gallery/upload/:category - העלאה עם עיבוד ושמירה כקובץ חדש
router.post("/upload/:category", upload.single("image"), async (req, res) => {
  const { category } = req.params;
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const categoryPath = path.join(baseGalleryPath, category);
  const originalPath = path.join(categoryPath, req.file.filename);
  const processedFilename = `processed-${req.file.filename}`;
  const processedPath = path.join(categoryPath, processedFilename);

  try {
    await sharp(originalPath)
      .grayscale()
      .threshold(180)
      .png()
      .toFile(processedPath);

    res.status(201).json({
      message: "Sketch uploaded and processed",
      imageUrl: `/sketchesTattoo/${category}/${processedFilename}`,
    });
  } catch (err) {
    console.error("Sharp processing error:", err);
    res.status(500).json({ error: "Failed to process sketch" });
  }
});

// ❌ DELETE /gallery/:category/:filename - מחיקת תמונה
router.delete("/:category/:filename", async (req, res) => {
  const { category, filename } = req.params;
  const filePath = path.join(baseGalleryPath, category, filename);

  try {
    await fsp.unlink(filePath);
    res.json({ message: "Image deleted successfully" });
  } catch (err) {
    console.error("Failed to delete file:", err);
    res.status(404).json({ error: "File not found or cannot be deleted" });
  }
});

export default router;
