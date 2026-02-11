import { verifyToken } from "../services/authService.js";
import User from "../users/models/User.schema.js";

function pickToken(req) {
  const x = req.header("x-auth-token");
  if (x) return String(x).trim();

  const auth = req.header("authorization");
  if (!auth) return "";
  const v = String(auth).trim();
  if (!v) return "";

  const lower = v.toLowerCase();
  if (lower.startsWith("bearer ")) return v.slice(7).trim();

  return "";
}

export const auth = async (req, res, next) => {
  const tokenFromClient = pickToken(req);
  if (!tokenFromClient) {
    return res.status(401).json({ error: "No token provided." });
  }

  try {
    const decoded = verifyToken(tokenFromClient);
    if (!decoded || !decoded._id) {
      return res.status(401).json({ error: "Invalid token." });
    }

    const user = await User.findById(decoded._id).select("_id isAdmin");
    if (!user) {
      return res.status(401).json({ error: "User not found." });
    }

    req.user = {
      _id: String(user._id),
      isAdmin: Boolean(user.isAdmin),
    };

    next();
  } catch {
    return res.status(401).json({ error: "Invalid token." });
  }
};
