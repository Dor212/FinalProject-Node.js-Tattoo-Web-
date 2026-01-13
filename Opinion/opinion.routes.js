import { Router } from "express";
import { getOpinions, postOpinion } from "./opinion.controller.js";
import { opinionRateLimit } from "./opinion.rateLimit.js";
import { opinionUpload } from "./opinion.upload.js";

const router = Router();

router.get("/", getOpinions);

router.post("/", opinionRateLimit, opinionUpload.single("image"), postOpinion);

export default router;
