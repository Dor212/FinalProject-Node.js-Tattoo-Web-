import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import {
  deleteCanvas,
  listCanvases,
  uploadCanvas,
} from "./controllers/canvases.controller.js";

const router = Router();

const canvasesDir = path.join(process.cwd(), "uploads", "canvases");
const variantsDir = path.join(process.cwd(), "uploads", "canvases", "variants");

if (!fs.existsSync(canvasesDir)) fs.mkdirSync(canvasesDir, { recursive: true });
if (!fs.existsSync(variantsDir)) fs.mkdirSync(variantsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "variantImages") return cb(null, variantsDir);
    return cb(null, canvasesDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    const safeExt = ext.length <= 10 ? ext : ".jpg";
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`;
    cb(null, name);
  },
});

const upload = multer({ storage });

router.get("/", listCanvases);

router.post(
  "/upload",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "variantImages", maxCount: 40 },
  ]),
  uploadCanvas,
);

router.delete("/:id", deleteCanvas);

export default router;
