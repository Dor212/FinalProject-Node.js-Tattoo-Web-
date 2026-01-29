import express from "express";
import { createOrder, getOrder, listOrders } from "./orders.controller.js";
import auth from "../middlewares/token.js";
import isAdmin from "../middlewares/isAdmin.js";

const router = express.Router();

router.post("/", createOrder);
router.get("/", auth, isAdmin, listOrders);
router.get("/:id", auth, isAdmin, getOrder);

export default router;
