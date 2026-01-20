import { Router } from "express";
import {
  getCanvases,
  createCanvas,
  deleteCanvas,
} from "../controllers/canvases.controller.js";

const router = Router();

router.get("/", getCanvases);
router.post("/", createCanvas);
router.delete("/:id", deleteCanvas);

export default router;
