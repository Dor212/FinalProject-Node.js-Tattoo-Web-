import Canvas from "../models/Canvas.js";
import cloudinary from "../../services/cloudinary.service.js";

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

function parseJsonArray(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getMainFiles(req) {
  const many = Array.isArray(req.files?.mainImages) ? req.files.mainImages : [];
  const single = req.files?.image?.[0] ? [req.files.image[0]] : [];
  return many.length ? many : single;
}

async function uploadMainImages(files, tag, base) {
  const uploaded = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file?.buffer) continue;

    const result = await uploadBufferToCloudinary(
      file.buffer,
      "omeravivart/canvases",
      `${tag}-${base}-${i + 1}`,
    );

    uploaded.push({
      imageUrl: result.secure_url,
      imagePublicId: result.public_id,
    });
  }

  return uploaded;
}

async function uploadVariants(
  rawVariants,
  variantImageIds,
  variantFiles,
  tag,
  base,
) {
  if (!Array.isArray(rawVariants) || !rawVariants.length) return [];

  const fileById = new Map();

  for (let i = 0; i < variantFiles.length; i++) {
    const id = variantImageIds[i];
    const file = variantFiles[i];
    if (typeof id === "string" && file?.buffer) fileById.set(id, file);
  }

  const cleaned = rawVariants.filter(
    (v) => v && typeof v.id === "string" && typeof v.color === "string",
  );

  const out = [];

  for (const variant of cleaned) {
    const file = fileById.get(variant.id);
    if (!file?.buffer) continue;

    const vBase = `${tag}-${base}-v-${safeNameBase(variant.id) || Math.round(Math.random() * 1e9)}`;
    const uploaded = await uploadBufferToCloudinary(
      file.buffer,
      "omeravivart/canvases/variants",
      vBase,
    );

    out.push({
      id: variant.id,
      color: String(variant.color),
      label: typeof variant.label === "string" ? variant.label : "",
      imageUrl: uploaded.secure_url,
      imagePublicId: uploaded.public_id,
    });
  }

  return out;
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
    const mainFiles = getMainFiles(req);

    if (!name || !size || !mainFiles.length) {
      return res.status(400).json({ message: "Missing name/size/images" });
    }

    const base = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const tag = safeNameBase(name) || "canvas";

    const mainUploads = await uploadMainImages(mainFiles, tag, base);
    if (!mainUploads.length) {
      return res.status(400).json({ message: "Missing valid images" });
    }

    const rawVariants = parseJsonArray(req.body?.variants);
    const variantImageIds = parseJsonArray(req.body?.variantImageIds);
    const variantFiles = Array.isArray(req.files?.variantImages)
      ? req.files.variantImages
      : [];
    const variants = await uploadVariants(
      rawVariants,
      variantImageIds,
      variantFiles,
      tag,
      base,
    );

    const created = await Canvas.create({
      name,
      size,
      imageUrl: mainUploads[0].imageUrl,
      imagePublicId: mainUploads[0].imagePublicId,
      imageUrls: mainUploads.map((item) => item.imageUrl),
      imagePublicIds: mainUploads.map((item) => item.imagePublicId),
      variants,
    });

    return res.status(201).json(created);
  } catch {
    return res.status(500).json({ message: "Failed to upload canvas" });
  }
}

export async function updateCanvas(req, res) {
  try {
    const { id } = req.params;
    const doc = await Canvas.findById(id);
    if (!doc) return res.status(404).json({ message: "Canvas not found" });

    const name = String(req.body?.name || "").trim();
    const size = String(req.body?.size || "").trim();

    if (name) doc.name = name;
    if (size) doc.size = size;

    const base = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const tag = safeNameBase(doc.name) || "canvas";

    const existingImageUrls =
      Array.isArray(doc.imageUrls) && doc.imageUrls.length
        ? [...doc.imageUrls]
        : doc.imageUrl
          ? [doc.imageUrl]
          : [];

    const existingImagePublicIds =
      Array.isArray(doc.imagePublicIds) && doc.imagePublicIds.length
        ? [...doc.imagePublicIds]
        : doc.imagePublicId
          ? [doc.imagePublicId]
          : [];

    const newMainFiles = getMainFiles(req);
    if (newMainFiles.length) {
      const uploadedMain = await uploadMainImages(newMainFiles, tag, base);
      existingImageUrls.push(...uploadedMain.map((item) => item.imageUrl));
      existingImagePublicIds.push(
        ...uploadedMain.map((item) => item.imagePublicId),
      );
    }

    doc.imageUrls = existingImageUrls;
    doc.imagePublicIds = existingImagePublicIds;

    if (existingImageUrls.length) doc.imageUrl = existingImageUrls[0];
    if (existingImagePublicIds.length)
      doc.imagePublicId = existingImagePublicIds[0];

    const rawVariants = parseJsonArray(req.body?.variants);
    const variantImageIds = parseJsonArray(req.body?.variantImageIds);
    const variantFiles = Array.isArray(req.files?.variantImages)
      ? req.files.variantImages
      : [];
    const newVariants = await uploadVariants(
      rawVariants,
      variantImageIds,
      variantFiles,
      tag,
      base,
    );

    if (newVariants.length) {
      const existingVariants = Array.isArray(doc.variants)
        ? [...doc.variants]
        : [];
      doc.variants = [...existingVariants, ...newVariants];
    }

    await doc.save();
    return res.json(doc);
  } catch {
    return res.status(500).json({ message: "Failed to update canvas" });
  }
}

export async function deleteCanvas(req, res) {
  try {
    const { id } = req.params;
    const doc = await Canvas.findById(id);
    if (!doc) return res.status(404).json({ message: "Canvas not found" });

    const publicIds = [
      ...(Array.isArray(doc.imagePublicIds) ? doc.imagePublicIds : []),
      doc.imagePublicId || "",
      ...(Array.isArray(doc.variants)
        ? doc.variants.map((v) => v?.imagePublicId || "")
        : []),
    ].filter(Boolean);

    for (const pid of publicIds) {
      try {
        await cloudinary.uploader.destroy(pid, { resource_type: "image" });
      } catch {
        continue;
      }
    }

    await Canvas.findByIdAndDelete(id);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ message: "Failed to delete canvas" });
  }
}
