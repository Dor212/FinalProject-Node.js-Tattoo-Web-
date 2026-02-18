import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";
import { promises as fsp } from "fs";
import { auth } from "../../middlewares/token.js";
import { isAdmin } from "../../middlewares/isAdmin.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const ALLOWED_CATEGORIES = ["small", "medium", "large"];
const ALLOWED_SET = new Set(ALLOWED_CATEGORIES);

const baseGalleryPath = path.join(__dirname, "../../public/sketchesTattoo");

const safeCategory = (raw) => {
  const c = String(raw || "")
    .toLowerCase()
    .trim();
  return ALLOWED_SET.has(c) ? c : null;
};

const safeFilename = (raw) => {
  const f = String(raw || "").trim();
  if (!f || f.includes("..") || f.includes("/") || f.includes("\\"))
    return null;
  return f;
};

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const toUrl = (category, file) => `/sketchesTattoo/${category}/${file}`;

const readCategoryUrls = async (category) => {
  const categoryPath = path.join(baseGalleryPath, category);
  try {
    const files = await fsp.readdir(categoryPath);
    return files
      .filter((f) => f && !f.startsWith("."))
      .map((file) => toUrl(category, file))
      .sort((a, b) => (a < b ? 1 : -1));
  } catch {
    return [];
  }
};

const requireCategory = (req, res, next) => {
  const category = safeCategory(req.params.category);
  if (!category)
    return res.status(400).json({ ok: false, message: "Invalid category" });
  req.sketchCategory = category;
  next();
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const category = req.sketchCategory || safeCategory(req.params.category);
    if (!category)
      return cb(
        Object.assign(new Error("Invalid category"), { statusCode: 400 }),
      );
    const categoryPath = path.join(baseGalleryPath, category);
    ensureDir(categoryPath);
    cb(null, categoryPath);
  },
  filename: (req, file, cb) => {
    const original = String(file.originalname || "image")
      .replace(/\s+/g, "_")
      .replace(/[^\w.\-()]/g, "");
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${original}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(png|jpeg|jpg|webp)$/i.test(file.mimetype || "");
    if (!ok)
      return cb(
        Object.assign(new Error("Unsupported file type"), { statusCode: 415 }),
      );
    cb(null, true);
  },
});

async function processSketchToTransparentInk(inputAbsPath, outAbsPath) {
  const whiteThr = 245;

  const { data, info } = await sharp(inputAbsPath)
    .ensureAlpha()
    .grayscale()
    .threshold(180)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = Buffer.from(data);

  for (let i = 0; i < out.length; i += 4) {
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];

    if (r >= whiteThr && g >= whiteThr && b >= whiteThr) {
      out[i + 3] = 0;
    } else {
      out[i] = 0;
      out[i + 1] = 0;
      out[i + 2] = 0;
      out[i + 3] = 255;
    }
  }

  await sharp(out, { raw: info }).png().toFile(outAbsPath);
}

router.get("/", async (req, res) => {
  try {
    const out = {};
    for (const cat of ALLOWED_CATEGORIES)
      out[cat] = await readCategoryUrls(cat);
    res.json(out);
  } catch {
    res.status(500).json({ ok: false, message: "Failed to load sketches" });
  }
});

router.get("/:category", async (req, res) => {
  const category = safeCategory(req.params.category);
  if (!category) return res.json([]);
  const urls = await readCategoryUrls(category);
  res.json(urls);
});

router.post(
  "/:category",
  auth,
  isAdmin,
  requireCategory,
  upload.single("image"),
  async (req, res) => {
    const category = req.sketchCategory;
    if (!req.file)
      return res.status(400).json({ ok: false, message: "No file uploaded" });

    const categoryPath = path.join(baseGalleryPath, category);
    const originalPath = path.join(categoryPath, req.file.filename);

    const baseName = path.parse(req.file.filename).name;
    const processedFilename = `processed-${baseName}.png`;
    const processedPath = path.join(categoryPath, processedFilename);

    try {
      await processSketchToTransparentInk(originalPath, processedPath);
      await fsp.unlink(originalPath).catch(() => {});
      return res
        .status(201)
        .json({ ok: true, imageUrl: toUrl(category, processedFilename) });
    } catch {
      await fsp.unlink(originalPath).catch(() => {});
      return res
        .status(500)
        .json({ ok: false, message: "Failed to process sketch" });
    }
  },
);

router.delete("/:category/:filename", auth, isAdmin, async (req, res) => {
  const category = safeCategory(req.params.category);
  const filename = safeFilename(req.params.filename);

  if (!category)
    return res.status(400).json({ ok: false, message: "Invalid category" });
  if (!filename)
    return res.status(400).json({ ok: false, message: "Invalid filename" });

  const filePath = path.join(baseGalleryPath, category, filename);

  try {
    await fsp.unlink(filePath);
    res.json({ ok: true });
  } catch {
    res
      .status(404)
      .json({ ok: false, message: "File not found or cannot be deleted" });
  }
});

router.use((err, req, res, next) => {
  const status = err?.statusCode || err?.status || 500;
  const message =
    status === 400
      ? "Bad request"
      : status === 401
        ? "Unauthorized"
        : status === 403
          ? "Forbidden"
          : status === 413
            ? "File too large"
            : status === 415
              ? "Unsupported file type"
              : "Server error";

  if (status === 500)
    return res.status(500).json({ ok: false, message: "Server error" });
  return res.status(status).json({ ok: false, message });
});

export default router;
