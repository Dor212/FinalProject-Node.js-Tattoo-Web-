import Canvas from "../models/Canvas.js";
import cloudinary from "../utils/cloudinary.js";

const ALLOWED_SIZES = new Set(["80×25", "50×40", "80×60"]);

const uploadToCloudinary = (buffer, folder) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (err, result) => {
        if (err) reject(err);
        else resolve(result);
      },
    );
    stream.end(buffer);
  });

export const listCanvases = async (req, res) => {
  const { size } = req.query;

  const query = {};
  if (typeof size === "string" && size.trim()) query.size = size.trim();

  const items = await Canvas.find(query).sort({ createdAt: -1 }).lean();
  res.json(items);
};

export const uploadCanvas = async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const size = String(req.body?.size || "").trim();

  if (!name) return res.status(400).json({ message: "name is required" });
  if (!size) return res.status(400).json({ message: "size is required" });
  if (!ALLOWED_SIZES.has(size))
    return res.status(400).json({ message: "invalid size" });
  if (!req.file?.buffer)
    return res.status(400).json({ message: "image is required" });

  const uploaded = await uploadToCloudinary(req.file.buffer, "omer/canvases");

  const doc = await Canvas.create({
    name,
    size,
    imageUrl: uploaded.secure_url,
    publicId: uploaded.public_id,
  });

  res.status(201).json(doc);
};

export const deleteCanvas = async (req, res) => {
  const { id } = req.params;

  const doc = await Canvas.findById(id);
  if (!doc) return res.status(404).json({ message: "not found" });

  await cloudinary.uploader.destroy(doc.publicId, { resource_type: "image" });
  await doc.deleteOne();

  res.json({ ok: true });
};
