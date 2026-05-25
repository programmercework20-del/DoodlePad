import User from "../models/User.js";
import Post from "../models/Post.js";
import Comment from "../models/Comment.js";
import Message from "../models/Message.js";
import Notification from "../models/Notification.js";
import Follower from "../models/Follower.js";

import { Op } from "sequelize";

const deleteDeactivatedAccounts = async () => {

  try {

    const expiredUsers = await User.findAll({
      where: {
        isDeactivated: true,
        scheduledDeletionAt: {
          [Op.lt]: new Date()
        }
      }
    });

    for (const user of expiredUsers) {

      const userId = user.id;

      console.log(
        `🗑 Permanently deleting user: ${user.username}`
      );

      await Post.destroy({
        where: { userId }
      });

      await Comment.destroy({
        where: { userId }
      });

      await Message.destroy({
        where: {
          [Op.or]: [
            { senderId: userId },
            { receiverId: userId }
          ]
        }
      });

      await Notification.destroy({
        where: {
          receiverId: userId
        }
      });

      await Follower.destroy({
        where: {
          [Op.or]: [
            { followerId: userId },
            { followingId: userId }
          ]
        }
      });

      await user.destroy();
    }

  } catch (error) {

    console.error(
      "Delete deactivated accounts cron error:",
      error
    );
  }
};

export default deleteDeactivatedAccounts;