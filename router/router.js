import { Router } from "express";
import usersRouter from "../users/routes/user.routes.js";
import galleryRouter from "../gallery/routes/gallery.routes.js"
import { auth } from "../middlewares/token.js";
import { isAdmin } from "../middlewares/isAdmin.js";
import { upload } from "../middlewares/upload.js";
import productRouter from "../products/routes/product.routes.js";
import path from "path";

const router = Router();

// בדיקת תקינות
router.get("/", (req, res) => {
  return res.json({ message: "Router is working" });
});

// ניהול קבצים - צפייה בלוגים והעלאה
router.get("/logs/:date", auth, isAdmin, (req, res) => {
  try {
    const { date } = req.params;
    return res.sendFile(path.join(process.cwd(), "logs", `${date}.txt`));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post("/upload", auth, upload, async (req, res) => {
  try {
    return res.json({ message: "File uploaded", file: req.filename });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

//  ראוטים עיקריים
router.use("/users", usersRouter);
router.use("/gallery", galleryRouter); 
router.use("/products", productRouter);

export default router;
