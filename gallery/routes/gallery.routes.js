import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";
import { promises as fsp } from "fs";
import { auth } from "../middlewares/token.js";
import { isAdmin } from "../middlewares/isAdmin.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const ALLOWED_CATEGORIES = new Set(["small", "medium", "large"]);

const baseGalleryPath = path.join(__dirname, "../../public/sketchesTattoo");

const safeCategory = (raw) => {
  const c = String(raw || "")
    .toLowerCase()
    .trim();
  return ALLOWED_CATEGORIES.has(c) ? c : null;
};

const safeFilename = (raw) => {
  const f = String(raw || "").trim();
  if (!f || f.includes("..") || f.includes("/") || f.includes("\\"))
    return null;
  return f;
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const category = safeCategory(req.params.category);
    if (!category) return cb(new Error("Invalid category"));

    const categoryPath = path.join(baseGalleryPath, category);
    if (!fs.existsSync(categoryPath)) {
      fs.mkdirSync(categoryPath, { recursive: true });
    }
    cb(null, categoryPath);
  },
  filename: (req, file, cb) => {
    const original = String(file.originalname || "image").replace(/\s+/g, "_");
    const uniqueName = `${Date.now()}-${original}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

router.get("/:category", (req, res) => {
  const category = safeCategory(req.params.category);
  if (!category) return res.json([]);

  const categoryPath = path.join(baseGalleryPath, category);
  if (!fs.existsSync(categoryPath)) {
    return res.json([]);
  }

  const files = fs.readdirSync(categoryPath);
  const urls = files.map((file) => `/sketchesTattoo/${category}/${file}`);
  res.json(urls);
});

router.post(
  "/upload/:category",
  auth,
  isAdmin,
  upload.single("image"),
  async (req, res) => {
    const category = safeCategory(req.params.category);
    if (!category) return res.status(400).json({ error: "Invalid category" });
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
      await fsp.unlink(originalPath).catch(() => {});
      res.status(201).json({
        message: "Sketch uploaded and processed",
        imageUrl: `/sketchesTattoo/${category}/${processedFilename}`,
      });
    } catch (err) {
      await fsp.unlink(originalPath).catch(() => {});
      res.status(500).json({ error: "Failed to process sketch" });
    }
  },
);

router.delete("/:category/:filename", auth, isAdmin, async (req, res) => {
  const category = safeCategory(req.params.category);
  const filename = safeFilename(req.params.filename);

  if (!category) return res.status(400).json({ error: "Invalid category" });
  if (!filename) return res.status(400).json({ error: "Invalid filename" });

  const filePath = path.join(baseGalleryPath, category, filename);

  try {
    await fsp.unlink(filePath);
    res.json({ message: "Image deleted successfully" });
  } catch (err) {
    res.status(404).json({ error: "File not found or cannot be deleted" });
  }
});

export default router;
