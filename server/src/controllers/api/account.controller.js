import User from "../../models/User.js";
import TokenBlacklist from "../../models/TokenBlacklist.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Op } from "sequelize";

export const deactivateAccount = async (req, res) => {

  try {

    const userId = req.user.id;

    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // already deactivated
    if (user.isDeactivated) {
      return res.status(400).json({
        success: false,
        message: "Account already deactivated"
      });
    }

    // 30 days delete schedule
    const deleteDate = new Date();
    deleteDate.setDate(deleteDate.getDate() + 30);

    await user.update({
      isDeactivated: true,
      deactivatedAt: new Date(),
      scheduledDeletionAt: deleteDate
    });

    // blacklist current token
    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith("Bearer")) {

      const token = authHeader.split(" ")[1];

      await TokenBlacklist.create({
        token,
        expiresAt: deleteDate
      });
    }

    return res.json({
      success: true,
      message: "Account deactivated successfully",
      restoreAvailableUntil: deleteDate
    });

  } catch (error) {

    console.error("Deactivate Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to deactivate account"
    });
  }
};

export const reactivateAccount = async (req, res) => {

  try {

    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: "Identifier and password required"
      });
    }

    const user = await User.findOne({
      where: {
        [Op.or]: [
          { username: identifier },
          { email: identifier },
          { phone: identifier }
        ]
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // account not deactivated
    if (!user.isDeactivated) {
      return res.status(400).json({
        success: false,
        message: "Account already active"
      });
    }

    // password check
    const isMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid password"
      });
    }

    // restore account
    await user.update({
      isDeactivated: false,
      deactivatedAt: null,
      scheduledDeletionAt: null
    });

    // generate fresh token
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN
      }
    );

    return res.json({
      success: true,
      message: "Account restored successfully",
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        phone: user.phone,
        profilePhoto: user.profilePhoto
      }
    });

  } catch (error) {

    console.error("Reactivate Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to restore account"
    });
  }
};