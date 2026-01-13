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
import opinionRouter from "./Opinion/opinion.index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

const allowedOrigins = [
  "https://www.omeravivart.com",
  "https://omeravivart.com",
  "https://finalproject-client-tattooweb.onrender.com",
  "http://localhost:5173",
];

app.use((req, res, next) => {
  res.header("Vary", "Origin");
  next();
});

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-auth-token"],
    maxAge: 86400,
  })
);

app.options("*", cors());
app.use(express.json({ limit: "5mb" }));
app.use(morganLogger);
app.use(router);
app.use(
  "/merchendise",
  express.static(path.join(__dirname, "public", "merchendise"))
);
app.use(
  "/sketchesTattoo",
  express.static(path.join(__dirname, "public", "sketchesTattoo"), {
    setHeaders: (res) => {
      res.set("Access-Control-Allow-Origin", "*");
    },
  })
);


app.use(express.static(path.join(__dirname, "public")));

app.get("/api/test", (req, res) => {
  res.json({ message: "החיבור בין השרת ללקוח עובד!" });
});

app.use(badPathHandler);
app.use(ErrorHandler);

app.listen(PORT, async () => {
  console.log(chalk.blue(`🚀 Server is running on port ${PORT}`));
  await conn();
});
