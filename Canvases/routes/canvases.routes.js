import { Router } from "express";
import uploadMemory from "../../middlewares/uploadMemory.js";
import {
  listCanvases,
  uploadCanvas,
  updateCanvas,
  deleteCanvas,
} from "../controllers/canvases.controller.js";

const router = Router();

const canvasUploadFields = uploadMemory.fields([
  { name: "image", maxCount: 1 },
  { name: "mainImages", maxCount: 40 },
  { name: "variantImages", maxCount: 40 },
]);

router.get("/", listCanvases);

router.post("/upload", canvasUploadFields, uploadCanvas);
router.patch("/:id", canvasUploadFields, updateCanvas);
router.delete("/:id", deleteCanvas);

export default router;
