import { Router } from "express";
import uploadMemory from "../middleware/uploadMemory.js";
import {
  getCanvases,
  createCanvas,
  deleteCanvas,
  uploadCanvas,
} from "../controllers/canvases.controller.js";

const router = Router();

router.get("/", getCanvases);
router.post("/upload", uploadMemory.any(), uploadCanvas);
router.delete("/:id", deleteCanvas);

export default router;
