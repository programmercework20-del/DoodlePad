import { verifyToken } from "../utils/jwt.js";

const userAuth = async (req, res, next) => {
  try {
    let token = req.cookies?.token;

    // Authorization: Bearer <token>
    if (
      !token &&
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token"
      });
    }

    /**
     * decoded payload example:
     * {
     *   id: "uuid",
     *   email: "...",
     *   role: "user",
     *   iat,
     *   exp
     * }
     */

    // Attach logged-in user info
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role || "user"
    };

    next();
  } catch (error) {
    console.error("User auth middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during authentication"
    });
  }
};

export default userAuth;
