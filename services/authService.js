import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const SECRET_KEY = String(process.env.SECRET_KEY || "").trim();

const generateToken = (user) => {
  const payloadData = {
    _id: user._id.toString(),
    isAdmin: Boolean(user.isAdmin),
  };
  return jwt.sign(payloadData, SECRET_KEY, { expiresIn: "1d" });
};

const verifyToken = (tokenFromClient) => {
  try {
    if (!SECRET_KEY) return null;
    return jwt.verify(tokenFromClient, SECRET_KEY);
  } catch {
    return null;
  }
};

export { generateToken, verifyToken };
