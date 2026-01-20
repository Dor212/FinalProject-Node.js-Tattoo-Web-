import Canvas from "../models/Canvas.js";
import cloudinary from "../config/cloudinary.js";

function isHexColor(v) {
  return typeof v === "string" && /^#([0-9a-fA-F]{6})$/.test(v.trim());
}

function slugId(v) {
  return String(v || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 32);
}

export async function getCanvases(req, res) {
  try {
    const canvases = await Canvas.find().sort({ createdAt: -1 }).lean();
    res.json(canvases);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
}

export async function createCanvas(req, res) {
  try {
    const { name, size, imageUrl, variants } = req.body;

    if (!name || !size || !imageUrl) {
      return res.status(400).json({ message: "Missing fields" });
    }

    if (!["80×25", "80×60", "50×40"].includes(size)) {
      return res.status(400).json({ message: "Invalid size" });
    }

    const rawVariants = Array.isArray(variants) ? variants : [];
    const cleanVariants = rawVariants
      .map((v) => ({
        id: slugId(v?.id || v?.label || v?.color),
        label: typeof v?.label === "string" ? v.label.trim() : "",
        color: typeof v?.color === "string" ? v.color.trim() : "",
        imageUrl: typeof v?.imageUrl === "string" ? v.imageUrl.trim() : "",
      }))
      .filter((v) => v.id && isHexColor(v.color) && v.imageUrl);

    const canvas = await Canvas.create({
      name: String(name).trim(),
      size,
      imageUrl: String(imageUrl).trim(),
      variants: cleanVariants,
    });

    res.status(201).json(canvas);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
}

export async function deleteCanvas(req, res) {
  try {
    const { id } = req.params;
    const deleted = await Canvas.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "Not found" });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
}

export async function uploadCanvas(req, res) {
  try {
    const { name, size } = req.body;
    const files = req.files || [];

    if (!name || !size || files.length === 0) {
      return res.status(400).json({ message: "Missing fields" });
    }

    // התמונה הראשית = הראשונה
    const mainFile = files[0];

    const mainUpload = await cloudinary.uploader.upload(
      `data:${mainFile.mimetype};base64,${mainFile.buffer.toString("base64")}`,
      { folder: "canvases" },
    );

    const variants = [];

    for (let i = 1; i < files.length; i++) {
      const f = files[i];

      const upload = await cloudinary.uploader.upload(
        `data:${f.mimetype};base64,${f.buffer.toString("base64")}`,
        { folder: "canvases" },
      );

      variants.push({
        id: `v-${i}`,
        color: "#000000",
        imageUrl: upload.secure_url,
      });
    }

    const canvas = await Canvas.create({
      name: name.trim(),
      size,
      imageUrl: mainUpload.secure_url,
      variants,
    });

    res.status(201).json(canvas);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Upload failed" });
  }
}
