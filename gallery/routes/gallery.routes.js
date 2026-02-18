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
  if (!f) return null;
  if (
    f.includes("..") ||
    f.includes("/") ||
    f.includes("\\") ||
    f.includes("%2f") ||
    f.includes("%5c")
  )
    return null;
  return f;
};

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const toUrl = (category, file) => `/sketchesTattoo/${category}/${file}`;

const processedNameFor = (originalFilename) => {
  const base = path.basename(originalFilename, path.extname(originalFilename));
  return `processed-${base}.png`;
};

async function processSketchToTransparentPng(inputAbsPath, outAbsPath) {
  const whiteThr = 245;

  const { data, info } = await sharp(inputAbsPath)
    .rotate()
    .ensureAlpha()
    .toColourspace("srgb")
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

  await sharp(out, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toFile(outAbsPath);
}

async function ensureProcessed(categoryPath, originalFilename) {
  const processedFilename = processedNameFor(originalFilename);
  const processedAbs = path.join(categoryPath, processedFilename);
  const originalAbs = path.join(categoryPath, originalFilename);

  try {
    await fsp.access(processedAbs);
    return processedFilename;
  } catch {}

  try {
    await processSketchToTransparentPng(originalAbs, processedAbs);
    await fsp.unlink(originalAbs).catch(() => {});
  } catch {
    return null;
  }

  return processedFilename;
}

const readCategoryUrls = async (category) => {
  const categoryPath = path.join(baseGalleryPath, category);
  try {
    ensureDir(categoryPath);
    const files = await fsp.readdir(categoryPath);

    const visible = files.filter(
      (f) => f && !f.startsWith(".") && !f.endsWith(".DS_Store"),
    );

    const processed = [];

    for (const file of visible) {
      const ext = path.extname(file).toLowerCase();
      const isPng = ext === ".png";
      const isAlreadyProcessed = isPng && file.startsWith("processed-");

      if (isAlreadyProcessed) {
        processed.push(file);
        continue;
      }

      const outName = await ensureProcessed(categoryPath, file);
      if (outName) processed.push(outName);
    }

    processed.sort((a, b) => b.localeCompare(a));
    return processed.map((file) => toUrl(category, file));
  } catch {
    return [];
  }
};

router.get("/", async (req, res) => {
  try {
    const out = {};
    for (const cat of ALLOWED_CATEGORIES) {
      out[cat] = await readCategoryUrls(cat);
    }
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

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const category = safeCategory(req.params.category);
    if (!category) return cb(new Error("Invalid category"));

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

const upload = multer({ storage });

router.post(
  "/:category",
  auth,
  isAdmin,
  upload.single("image"),
  async (req, res) => {
    const category = safeCategory(req.params.category);
    if (!category)
      return res.status(400).json({ ok: false, message: "Invalid category" });
    if (!req.file)
      return res.status(400).json({ ok: false, message: "No file uploaded" });

    const categoryPath = path.join(baseGalleryPath, category);
    const originalPath = path.join(categoryPath, req.file.filename);

    const processedFilename = processedNameFor(req.file.filename);
    const processedPath = path.join(categoryPath, processedFilename);

    try {
      await processSketchToTransparentPng(originalPath, processedPath);
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

export default router;
