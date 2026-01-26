import { Router } from "express";
import uploadMemory from "../../middlewares/uploadMemory.js";
import {
  listCanvases,
  uploadCanvas,
  deleteCanvas,
} from "../controllers/canvases.controller.js";

const router = Router();

router.get("/", listCanvases);

router.post(
  "/upload",
  uploadMemory.fields([
    { name: "image", maxCount: 1 },
    { name: "variantImages", maxCount: 40 },
  ]),
  uploadCanvas,
);

router.delete("/:id", deleteCanvas);

export default router;
