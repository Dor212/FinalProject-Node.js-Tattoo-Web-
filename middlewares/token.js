import { verifyToken } from "../services/authService.js";
import User from "../users/models/User.schema.js";

export const auth = async (req, res, next) => {
  const tokenFromClient = req.header("x-auth-token");
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
  } catch (err) {
    return res.status(401).json({ error: "Invalid token." });
  }
};
