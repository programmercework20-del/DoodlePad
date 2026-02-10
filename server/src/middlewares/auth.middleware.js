import jwt from "jsonwebtoken";
import User from "../models/User.js";
import TokenBlacklist from "../models/TokenBlacklist.js";

export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer")) {
      return res.status(401).json({ success: false, message: "Not authorized" });
    }

    const token = authHeader.split(" ")[1];

     // ⭐ CHECK BLACKLIST FIRST
    const blacklisted = await TokenBlacklist.findOne({ where: { token } });
    if (blacklisted) {
      return res.status(401).json({ message: "Token expired. Please login again" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    req.user = user; // 🔥 yahin se userId milega
    next();

  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};
