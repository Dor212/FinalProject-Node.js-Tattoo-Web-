import { Router } from "express";
import uploadMemory from "../middleware/uploadMemory.js";
import {
  deleteCanvas,
  listCanvases,
  uploadCanvas,
} from "../controllers/canvases.controller.js";

const router = Router();

router.get("/", listCanvases);
router.post("/upload", uploadMemory.single("image"), uploadCanvas);
router.delete("/:id", deleteCanvas);

export default router;
