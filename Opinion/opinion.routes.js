import { Router } from "express";
import { getOpinions, postOpinion } from "./opinion.controller.js";
import { opinionRateLimit } from "./opinion.rateLimit.js";
import { opinionUpload } from "./opinion.upload.js";
import Opinion from "./opinion.model.js";
import cloudinary from "./cloudinary.service.js";
import { auth } from "../middlewares/auth.js";

const router = Router();

const requireAdmin = (req, res, next) => {
  if (req.user?.isAdmin) return next();
  return res.status(403).json({ error: "Admin only." });
};

const publicIdFromCloudinaryUrl = (url) => {
  try {
    const u = new URL(String(url || ""));
    const parts = u.pathname.split("/").filter(Boolean);
    const uploadIdx = parts.indexOf("upload");
    if (uploadIdx === -1) return null;

    let after = parts.slice(uploadIdx + 1);
    if (after[0] && /^v\d+$/.test(after[0])) after = after.slice(1);

    const full = after.join("/");
    if (!full) return null;

    return full.replace(/\.[^.]+$/, "");
  } catch {
    return null;
  }
};

router.get("/", getOpinions);

router.post("/", opinionRateLimit, opinionUpload.single("image"), postOpinion);

router.delete("/:id", auth, requireAdmin, async (req, res) => {
  const { id } = req.params;

  const op = await Opinion.findById(id).lean();
  if (!op) return res.status(404).json({ error: "Not found." });

  const publicId = publicIdFromCloudinaryUrl(op.imageUrl);

  if (publicId) {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
    } catch {}
  }

  await Opinion.deleteOne({ _id: id });

  res.json({ ok: true, id });
});

export default router;
