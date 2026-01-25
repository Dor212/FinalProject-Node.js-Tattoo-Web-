import fs from "fs/promises";
import path from "path";
import Canvas from "../models/Canvas.js";

const uploadsRoot = path.join(process.cwd(), "uploads");

function toPublicUrl(req, relPath) {
  const base = `${req.protocol}://${req.get("host")}`;
  const normalized = relPath.replaceAll("\\", "/");
  return `${base}${normalized.startsWith("/") ? "" : "/"}${normalized}`;
}

async function safeUnlink(absPath) {
  try {
    await fs.unlink(absPath);
  } catch {
    return;
  }
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

    const exists = await Canvas.findOne({ name, size });
    if (exists) {
      return res.status(409).json({
        message:
          "כבר קיים קאנבס עם אותו שם ומידה. מחק אותו בעמוד אדמין ואז העלה מחדש.",
      });
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

      variants = rawVariants
        .filter(
          (v) => v && typeof v.id === "string" && typeof v.color === "string",
        )
        .map((v) => {
          const fileName = fileById.get(v.id);
          if (!fileName) return null;

          const rel = `/uploads/canvases/variants/${fileName}`;
          return {
            id: v.id,
            color: String(v.color),
            label: typeof v.label === "string" ? v.label : "",
            imageUrl: toPublicUrl(req, rel),
          };
        })
        .filter(Boolean);
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
      const abs = path.join(process.cwd(), rel);
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
