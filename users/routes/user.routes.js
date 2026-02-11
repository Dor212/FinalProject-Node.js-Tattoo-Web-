import { Router } from "express";
import User from "../models/User.schema.js";
import {
  addUser,
  deleteUser,
  getUserById,
} from "../services/userDataAccess.service.js";
import { validation } from "../../middlewares/validation.js";
import LoginSchema from "../validations/LoginSchema.js";
import RegisterSchema from "../validations/RegisterSchema.js";
import { generateToken } from "../../services/authService.js";
import { auth } from "../../middlewares/token.js";
import { isAdmin } from "../../middlewares/isAdmin.js";
import nodemailer from "nodemailer";
import bcrypt from "bcryptjs";

const router = Router();

const ADMIN_EMAIL = String(
  process.env.ADMIN_EMAIL || process.env.MY_EMAIL || "dorohana212@gmail.com",
).trim();
const SMTP_HOST = String(process.env.SMTP_HOST || "").trim();
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE =
  String(process.env.SMTP_SECURE || "")
    .trim()
    .toLowerCase() === "true" || SMTP_PORT === 465;
const SMTP_USER = String(process.env.SMTP_USER || "").trim();
const SMTP_PASS = String(process.env.SMTP_PASS || "").trim();
const SMTP_FROM = String(
  process.env.SMTP_FROM || process.env.MY_EMAIL || SMTP_USER || "",
).trim();

function makeTransport() {
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    return nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }

  const gmailUser = String(process.env.MY_EMAIL || "").trim();
  const gmailPass = String(process.env.MY_EMAIL_PASSWORD || "").trim();
  if (gmailUser && gmailPass) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailPass },
    });
  }

  throw new Error("Missing SMTP credentials");
}

function parseBase64Image(dataUrl) {
  const s = String(dataUrl || "");
  const m = s.match(/^data:(image\/(png|jpeg|jpg));base64,(.+)$/i);
  if (!m) return null;
  const mime = m[1].toLowerCase();
  const base64 = m[3];
  const ext = mime.includes("png") ? "png" : "jpg";
  const buf = Buffer.from(base64, "base64");
  return { mime, ext, buf };
}

router.post("/register", validation(RegisterSchema), async (req, res) => {
  try {
    const data = req.body;
    const newUser = await addUser(data);
    return res.json({ message: "User Created", newUser });
  } catch (err) {
    return res.status(500).send(err.message);
  }
});

router.post("/login", validation(LoginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(401).json({ error: "Invalid email or password" });

    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch)
      return res.status(401).json({ error: "Invalid email or password" });

    const token = generateToken(user);
    return res.json({ token });
  } catch (err) {
    return res.status(500).send(err.message);
  }
});

router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json({ user });
  } catch (err) {
    return res.status(500).json({ error: "Failed to load user" });
  }
});

router.get("/", auth, isAdmin, async (req, res) => {
  try {
    const users = await User.find();
    return res.json(users);
  } catch (err) {
    return res.status(500).send(err.message);
  }
});

router.get("/:id", auth, async (req, res) => {
  try {
    const isSelf = req.user._id === String(req.params.id);
    if (!isSelf && !req.user.isAdmin)
      return res.status(403).json({ error: "Forbidden" });

    const user = await getUserById(req.params.id);
    return res.json(user);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.delete("/:id", auth, isAdmin, async (req, res) => {
  try {
    await deleteUser(req.params.id);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).send(err.message);
  }
});

router.post("/send-image", async (req, res) => {
  try {
    const { image, name, phone, email } = req.body || {};
    if (!image || !name || !phone) {
      return res
        .status(400)
        .json({ error: "Missing image, name or phone number" });
    }

    const parsed = parseBase64Image(image);
    if (!parsed) return res.status(400).json({ error: "Invalid image format" });

    const transporter = makeTransport();

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.45;color:#111;">
        <h2 style="margin:0 0 10px;">בקשת הדמיה חדשה</h2>
        <div><strong>שם:</strong> ${String(name)}</div>
        <div><strong>טלפון:</strong> ${String(phone)}</div>
        ${email ? `<div><strong>אימייל:</strong> ${String(email)}</div>` : ""}
        <div style="margin-top:10px;">התמונה מצורפת.</div>
      </div>
    `;

    await transporter.sendMail({
      from: SMTP_FROM || ADMIN_EMAIL,
      to: ADMIN_EMAIL,
      subject: "New Tattoo Preview Submission",
      html,
      attachments: [
        {
          filename: `simulation.${parsed.ext}`,
          content: parsed.buf,
          contentType: parsed.mime,
        },
      ],
    });

    return res
      .status(200)
      .json({ message: "Image and details sent to email!" });
  } catch {
    return res.status(500).json({ error: "Failed to send email" });
  }
});

router.post("/contact", async (req, res) => {
  try {
    const { name, email, message, phone } = req.body || {};
    if (!name || !email || !message) {
      return res.status(400).json({ error: "Missing name, email or message" });
    }

    const transporter = makeTransport();

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.45;color:#111;">
        <h2 style="margin:0 0 10px;">פנייה חדשה מהאתר</h2>
        <div><strong>שם:</strong> ${String(name)}</div>
        <div><strong>אימייל:</strong> ${String(email)}</div>
        ${phone ? `<div><strong>טלפון:</strong> ${String(phone)}</div>` : ""}
        <div style="margin-top:10px;"><strong>הודעה:</strong></div>
        <div style="white-space:pre-wrap;">${String(message)}</div>
      </div>
    `;

    await transporter.sendMail({
      from: SMTP_FROM || ADMIN_EMAIL,
      to: ADMIN_EMAIL,
      subject: `New message from ${String(name)}`,
      html,
      replyTo: String(email),
    });

    return res.json({ message: "Email sent" });
  } catch {
    return res.status(500).json({ error: "Email failed" });
  }
});

export default router;
