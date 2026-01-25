import fs from "fs/promises";
import path from "path";
import Canvas from "../models/Canvas.js";

const uploadsRoot = path.join(process.cwd(), "uploads");
const canvasesAbsDir = path.join(uploadsRoot, "canvases");
const variantsAbsDir = path.join(canvasesAbsDir, "variants");

function toPublicUrl(req, relPath) {
  const base = `${req.protocol}://${req.get("host")}`;
  const normalized = String(relPath || "").replaceAll("\\", "/");
  return `${base}${normalized.startsWith("/") ? "" : "/"}${normalized}`;
}

async function exists(absPath) {
  try {
    await fs.access(absPath);
    return true;
  } catch {
    return false;
  }
}

async function safeUnlink(absPath) {
  try {
    await fs.unlink(absPath);
  } catch {
    return;
  }
}

function relToAbs(rel) {
  const clean = String(rel || "").replace(/^\/+/, "");
  return path.join(process.cwd(), clean);
}

export async function listCanvases(req, res) {
  try {
    const items = await Canvas.find().sort({ createdAt: -1 });
    return res.json(items);
  } catch {
    return res.status(500).json({ message: "Failed to fetch canvases" });
  }
}

export async function uploadCanvas(req, res) {
  try {
    const name = String(req.body?.name || "").trim();
    const size = String(req.body?.size || "").trim();

    const mainFile = req.files?.image?.[0] || null;
    if (!name || !size || !mainFile) {
      return res.status(400).json({ message: "Missing name/size/image" });
    }

    const mainRel = `/uploads/canvases/${mainFile.filename}`;
    const imageUrl = toPublicUrl(req, mainRel);

    let variants = [];
    const rawVariants = req.body?.variants ? JSON.parse(req.body.variants) : [];
    const variantImageIds = req.body?.variantImageIds
      ? JSON.parse(req.body.variantImageIds)
      : [];

    const variantFiles = Array.isArray(req.files?.variantImages)
      ? req.files.variantImages
      : [];

    if (
      Array.isArray(rawVariants) &&
      rawVariants.length > 0 &&
      Array.isArray(variantImageIds)
    ) {
      const fileById = new Map();
      for (let i = 0; i < variantFiles.length; i++) {
        const id = variantImageIds[i];
        const f = variantFiles[i];
        if (typeof id === "string" && f?.filename) {
          fileById.set(id, f.filename);
        }
      }

      const cleaned = rawVariants.filter(
        (v) => v && typeof v.id === "string" && typeof v.color === "string",
      );

      const out = [];
      for (const v of cleaned) {
        const fileName = fileById.get(v.id);
        if (!fileName) continue;

        const absVariant = path.join(variantsAbsDir, fileName);
        const absCanvas = path.join(canvasesAbsDir, fileName);

        const rel = (await exists(absVariant))
          ? `/uploads/canvases/variants/${fileName}`
          : (await exists(absCanvas))
            ? `/uploads/canvases/${fileName}`
            : `/uploads/canvases/variants/${fileName}`;

        out.push({
          id: v.id,
          color: String(v.color),
          label: typeof v.label === "string" ? v.label : "",
          imageUrl: toPublicUrl(req, rel),
        });
      }

      variants = out;
    }

    const created = await Canvas.create({
      name,
      size,
      imageUrl,
      variants,
    });

    return res.status(201).json(created);
  } catch {
    return res.status(500).json({ message: "Failed to upload canvas" });
  }
}

export async function deleteCanvas(req, res) {
  try {
    const { id } = req.params;
    const doc = await Canvas.findById(id);
    if (!doc) return res.status(404).json({ message: "Canvas not found" });

    const urls = [doc.imageUrl, ...(doc.variants || []).map((v) => v.imageUrl)];
    for (const url of urls) {
      const u = String(url || "");
      const idx = u.indexOf("/uploads/");
      if (idx === -1) continue;

      const rel = u.slice(idx);
      const abs = relToAbs(rel);
      if (abs.startsWith(uploadsRoot)) {
        await safeUnlink(abs);
      }
    }

    await Canvas.findByIdAndDelete(id);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ message: "Failed to delete canvas" });
  }
}
