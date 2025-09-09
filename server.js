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
const PORT = process.env.PORT || 8080;

// ✅ CORS — רשימת דומיינים מותרים
const allowedOrigins = [
  "https://www.omeravivart.com",
  "https://omeravivart.com",
  "https://finalproject-client-tattooweb.onrender.com",
  "http://localhost:5173", // לפיתוח מקומי
];

// ✅ חשוב להוסיף לפני כל הראוטים/סטטיים (כדי שמטמונים יבדילו בין מקורות שונים)
app.use((req, res, next) => {
  res.header("Vary", "Origin");
  next();
});

// ✅ CORS ראשי
app.use(
  cors({
    origin(origin, cb) {
      // בקשות בלי Origin (curl/healthchecks) – לא לחסום
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true, // בסדר גם אם לא עובדים כרגע עם cookies
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-auth-token"],
    maxAge: 86400, // cache ל-preflight
  })
);

// ✅ לאפשר preflight לכל הנתיבים
app.options("*", cors());

// ✅ הגדרות כלליות
app.use(express.json({ limit: "5mb" }));
app.use(morganLogger);

// ✅ הגשת קבצים סטטיים
app.use(
  "/merchendise",
  express.static(path.join(__dirname, "public", "merchendise"))
);

// מותר cross-origin לתיקייה הזו (אין cookies כאן, אז '*' בסדר)
app.use(
  "/sketchesTattoo",
  express.static(path.join(__dirname, "public", "sketchesTattoo"), {
    setHeaders: (res) => {
      res.set("Access-Control-Allow-Origin", "*");
    },
  })
);

app.use(express.static(path.join(__dirname, "public")));

// ✅ בדיקת חיבור מהלקוח (לפני 404/error handlers)
app.get("/api/test", (req, res) => {
  res.json({ message: "החיבור בין השרת ללקוח עובד!" });
});

// ✅ רואטר ראשי
app.use(router);

// ✅ ניהול שגיאות ונתיבים לא קיימים (אחרי כל הראוטים)
app.use(badPathHandler);
app.use(ErrorHandler);

// ✅ הפעלת השרת + חיבור למסד
app.listen(PORT, async () => {
  console.log(chalk.blue(`🚀 Server is running on port ${PORT}`));
  await conn();
});
