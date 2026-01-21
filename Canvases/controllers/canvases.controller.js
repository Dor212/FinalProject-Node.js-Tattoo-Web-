import Canvas from "../models/Canvas.js";
import cloudinary from "../utils/cloudinary.js";

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
    const { name, size } = req.body;
    const files = req.files || [];

    if (!name || !size || files.length === 0) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const mainUpload = await cloudinary.uploader.upload(
      `data:${files[0].mimetype};base64,${files[0].buffer.toString("base64")}`,
      { folder: "canvases" },
    );

    const canvas = await Canvas.create({
      name: name.trim(),
      size,
      imageUrl: mainUpload.secure_url,
      variants: [],
    });

    res.status(201).json(canvas);
  } catch {
    res.status(500).json({ message: "Create failed" });
  }
}

export async function addVariant(req, res) {
  try {
    const { id } = req.params;
    const { color, label, stock } = req.body;
    const file = req.file;

    if (!file || !isHexColor(color)) {
      return res.status(400).json({ message: "Invalid data" });
    }

    const upload = await cloudinary.uploader.upload(
      `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
      { folder: "canvases" },
    );

    const variant = {
      id: slugId(label || color),
      label: label || "",
      color,
      imageUrl: upload.secure_url,
      stock: Number(stock) || 0,
    };

    const canvas = await Canvas.findByIdAndUpdate(
      id,
      { $push: { variants: variant } },
      { new: true },
    );

    if (!canvas) return res.status(404).json({ message: "Not found" });

    res.json(canvas);
  } catch {
    res.status(500).json({ message: "Add variant failed" });
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
