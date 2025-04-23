import express from "express";
import router from "./router/router.js";
import chalk from "chalk";
import { morganLogger } from "./middlewares/morganLogger.js";
import { badPathHandler } from "./middlewares/badPathHandler.js";
import { ErrorHandler } from "./middlewares/errorHandler.js";
import { conn } from "./services/db.services.js";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

// ✅ פתרון ל-__dirname עבור ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// ✅ הגדרת אפליקציה
const app = express();
const { SERVER } = process.env;
const PORT = SERVER || 8080;

// ✅ הגדרות כלליות
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "5mb" }));
app.use(morganLogger);

// ✅ הגשת קבצים סטטיים
app.use("/merchendise", express.static(path.join(__dirname, "public", "merchendise")));
app.use("/sketchesTattoo", express.static(path.join(__dirname, "public", "sketchesTattoo"), {
  setHeaders: (res) => {
    res.set("Access-Control-Allow-Origin", "*");
  },
}));
app.use(express.static(path.join(__dirname, "public")));

// ✅ רואטר ראשי
app.use(router);

// ✅ ניהול שגיאות ונתיבים לא קיימים
app.use(badPathHandler);
app.use(ErrorHandler);

// ✅ בדיקת חיבור מהלקוח
app.get("/api/test", (req, res) => {
  res.json({ message: "החיבור בין השרת ללקוח עובד!" });
});

// ✅ הפעלת השרת + מילוי יוזרים
app.listen(PORT, async () => {
  console.log(chalk.blue(`🚀 Server is running on port ${PORT}`));
  await conn();
});
