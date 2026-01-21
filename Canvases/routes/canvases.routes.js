import { Router } from "express";
import uploadMemory from "../middleware/uploadMemory.js";
import {
  getCanvases,
  createCanvas,
  deleteCanvas,
  addVariant,
} from "../controllers/canvases.controller.js";

const router = Router();

router.get("/", getCanvases);
router.post("/", uploadMemory.any(), createCanvas);
router.post("/:id/variants", uploadMemory.single("image"), addVariant);
router.delete("/:id", deleteCanvas);

export default router;
