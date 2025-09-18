import { Router } from "express";
import User from "../models/User.schema.js"
import {
  addUser,
  deleteUser,
  login,
  getUserById,
} from "../services/userDataAccess.service.js";
import { validation } from "../../middlewares/validation.js";
import LoginSchema from "../validations/LoginSchema.js";
import RegisterSchema from "../validations/RegisterSchema.js";
import { generateToken } from "../../services/authService.js";
import { auth } from "../../middlewares/token.js";
import { isAdmin } from "../../middlewares/isAdmin.js";
import { v4 as uuid } from "uuid";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from "fs";
import nodemailer from "nodemailer";
import multer from "multer";
import bcrypt from "bcryptjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const baseGalleryPath = path.join(__dirname, "../../../public/sketchesTattoo");

const galleryStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const category = req.params.category;``
    const uploadPath = path.join(baseGalleryPath, category);

    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + extension);
  },
});

const uploadGallery = multer({ storage: galleryStorage });


const router = Router();


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
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = generateToken(user);

    res.json({ token });
  } catch (err) {
    return res.status(500).send(err.message);
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
    const user = await getUserById(req.params.id);
    return res.json(user);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});


router.delete("/:id", auth, isAdmin, async (req, res) => {
  try {
    const user = await deleteUser(req.params.id);
    return res.send("User Delete");
  } catch (err) {
    return res.status(500).send(err.message);
  }
});

router.post("/send-image", async (req, res) => {
  try {
    const { image, name, phone } = req.body;
    const artistEmail = "dorohana212@gmail.com";

    if (!image || !name || !phone) {
      return res
        .status(400)
        .json({ error: "Missing image, name or phone number" });
    }

    const fileName = `${uuid()}.png`;
    const filePath = path.join(__dirname, "../../../public/temp", fileName);
    const base64Data = image.replace(/^data:image\/png;base64,/, "");

    if (!fs.existsSync(path.dirname(filePath))) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }

    fs.writeFileSync(filePath, base64Data, "base64");

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.MY_EMAIL,
        pass: process.env.MY_EMAIL_PASSWORD,
      },
    });

    const mailOptions = {
      from: process.env.MY_EMAIL,
      to: artistEmail,
      subject: "New Tattoo Preview Submission",
      text: `New tattoo preview was submitted from the website.\n\nName: ${name}\nPhone: ${phone}`,
      attachments: [
        {
          filename: fileName,
          path: filePath,
        },
      ],
    };

    await transporter.sendMail(mailOptions);

    setTimeout(() => {
      fs.unlink(filePath, () => {});
    }, 5000);

    res.status(200).json({ message: "Image and details sent to email!" });
  } catch (err) {
    console.error("Error sending email:", err);
    res.status(500).json({ error: "Failed to send email" });
  }
});

router.post("/contact", async (req, res) => {
  const { name, email, message } = req.body;
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.MY_EMAIL,
        pass: process.env.MY_EMAIL_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: `"Website Contact" <${process.env.SMTP_USER}>`,
      to: "your-email@domain.com",
      subject: `New message from ${name}`,
      html: `<p><strong>From:</strong> ${name} (${email})</p><p>${message}</p>`,
    });

    res.json({ message: "Email sent" });
  } catch (err) {
    console.error("Error sending email:", err);
    res.status(500).json({ error: "Email failed" });
  }
});

export default router;