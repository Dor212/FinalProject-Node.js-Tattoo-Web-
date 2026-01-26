import fs from "fs/promises";
import path from "path";
import Canvas from "../models/Canvas.js";
import cloudinary from "../../services/cloudinary.service.js";

const uploadsRoot = path.join(process.cwd(), "uploads");

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

function uploadBufferToCloudinary(buffer, folder, publicIdBase) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicIdBase,
        resource_type: "image",
        overwrite: false,
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      },
    );
    stream.end(buffer);
  });
}

function safeNameBase(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "")
    .slice(0, 60);
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
    if (!name || !size || !mainFile?.buffer) {
      return res.status(400).json({ message: "Missing name/size/image" });
    }

    const base = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const tag = safeNameBase(name) || "canvas";

    const mainUpload = await uploadBufferToCloudinary(
      mainFile.buffer,
      "omeravivart/canvases",
      `${tag}-${base}`,
    );

    const imageUrl = mainUpload.secure_url;
    const imagePublicId = mainUpload.public_id;

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
        if (typeof id === "string" && f?.buffer) {
          fileById.set(id, f);
        }
      }

      const cleaned = rawVariants.filter(
        (v) => v && typeof v.id === "string" && typeof v.color === "string",
      );

      const out = [];
      for (const v of cleaned) {
        const f = fileById.get(v.id);
        if (!f?.buffer) continue;

        const vBase = `${tag}-${base}-v-${safeNameBase(v.id) || Math.round(Math.random() * 1e9)}`;
        const uploaded = await uploadBufferToCloudinary(
          f.buffer,
          "omeravivart/canvases/variants",
          vBase,
        );

        out.push({
          id: v.id,
          color: String(v.color),
          label: typeof v.label === "string" ? v.label : "",
          imageUrl: uploaded.secure_url,
          imagePublicId: uploaded.public_id,
        });
      }

      variants = out;
    }

    const created = await Canvas.create({
      name,
      size,
      imageUrl,
      imagePublicId,
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

    const pids = [];
    if (doc.imagePublicId) pids.push(doc.imagePublicId);
    for (const v of doc.variants || []) {
      if (v?.imagePublicId) pids.push(v.imagePublicId);
    }

    for (const pid of pids) {
      try {
        await cloudinary.uploader.destroy(pid, { resource_type: "image" });
      } catch {
        continue;
      }
    }

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
