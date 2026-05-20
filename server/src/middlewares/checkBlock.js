
import Block from "../models/Block.js";
import { Op } from "sequelize";

export const checkBlock = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const targetId = req.params.id || req.body.receiverId;

    if (!targetId) return next();

    const blocked = await Block.findOne({
      where: {
        [Op.or]: [
          { blockerId: userId, blockedId: targetId },
          { blockerId: targetId, blockedId: userId }
        ]
      }
    });

    if (blocked) {
      return res.status(403).json({
        message: "Action not allowed (user blocked)"
      });
    }

    next();

  } catch (err) {
    next(err);
  }
};