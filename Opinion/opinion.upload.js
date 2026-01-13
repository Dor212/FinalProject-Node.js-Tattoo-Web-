import multer from "multer";

export const opinionUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ["image/jpeg", "image/png", "image/webp"].includes(
      file.mimetype
    );
    cb(ok ? null : new Error("Invalid image type"), ok);
  },
});
