import "dotenv/config";
import express from "express";
import chalk from "chalk";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import router from "./router/router.js";
import { morganLogger } from "./middlewares/morganLogger.js";
import { badPathHandler } from "./middlewares/badPathHandler.js";
import { ErrorHandler } from "./middlewares/errorHandler.js";
import { conn } from "./services/db.services.js";
import canvasesRouter from "./Canvases/routes/canvases.routes.js";
import hypayRoutes from "./routes/hypay.routes.js";
import ordersRoutes from "./orders/orders.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set("trust proxy", 1);

const PORT = Number(process.env.PORT || 8080);

const splitCsv = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const allowedOrigins = Array.from(
  new Set([
    "https://www.omeravivart.com",
    "https://omeravivart.com",
    "https://finalproject-client-tattooweb.onrender.com",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    ...splitCsv(process.env.CORS_ORIGINS),
  ]),
);

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-auth-token",
    "X-Requested-With",
  ],
  optionsSuccessStatus: 204,
  maxAge: 86400,
};

app.use((req, res, next) => {
  res.header("Vary", "Origin");
  next();
});

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(morganLogger);

app.get("/", (req, res) => {
  res.json({ ok: true, message: "API is running" });
});

app.get("/api/test", (req, res) => {
  res.json({ ok: true, message: "החיבור בין השרת ללקוח עובד!" });
});

app.use("/api/hyp", hypayRoutes);
app.use("/api/orders", ordersRoutes);

app.use(
  "/uploads",
  express.static(path.join(process.cwd(), "uploads"), {
    setHeaders: (res) => {
      res.set("Access-Control-Allow-Origin", "*");
    },
  }),
);

app.use(
  "/merchendise",
  express.static(path.join(__dirname, "public", "merchendise")),
);

app.use(
  "/sketchesTattoo",
  express.static(path.join(__dirname, "public", "sketchesTattoo"), {
    setHeaders: (res) => {
      res.set("Access-Control-Allow-Origin", "*");
    },
  }),
);

app.use("/canvases", canvasesRouter);
app.use(router);
app.use(express.static(path.join(__dirname, "public")));

app.use(badPathHandler);
app.use(ErrorHandler);

async function startServer() {
  try {
    await conn();
    app.listen(PORT, () => {
      console.log(chalk.blue(`🚀 Server is running on port ${PORT}`));
      console.log(chalk.gray(`Allowed origins: ${allowedOrigins.join(", ")}`));
    });
  } catch (error) {
    console.error(chalk.red("Failed to start server"), error);
    process.exit(1);
  }
}

startServer();
