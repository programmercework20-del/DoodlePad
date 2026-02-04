import Report from "../../models/Report.js";
import Post from "../../models/Post.js";
import Comment from "../../models/Comment.js";
import User from "../../models/User.js";
import Live from "../../models/Live.js";
import Message from "../../models/Message.js";

export const createReport = async (req, res) => {
  try {
    const reporterId = req.user.id;
    const { targetType, targetId, reason, description } = req.body;

    // 1️⃣ Validate targetType
    const allowedTypes = ["post", "comment", "user", "live", "message"];
    if (!allowedTypes.includes(targetType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid target type"
      });
    }

    // 2️⃣ Validate reason
    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Reason is required"
      });
    }

    // 3️⃣ Find target model
    let targetModel;
    if (targetType === "post") targetModel = Post;
    if (targetType === "comment") targetModel = Comment;
    if (targetType === "user") targetModel = User;
    if (targetType === "live") targetModel = Live;
    if (targetType === "message") targetModel = Message;

    const target = await targetModel.findByPk(targetId);
    if (!target) {
      return res.status(404).json({
        success: false,
        message: `${targetType} not found`
      });
    }

    // 4️⃣ Prevent self-report
    if (targetType === "user" && target.id === reporterId) {
      return res.status(403).json({
        success: false,
        message: "You cannot report yourself"
      });
    }

    if ((targetType === "post" || targetType === "comment") && target.userId === reporterId) {
      return res.status(403).json({
        success: false,
        message: "You cannot report your own content"
      });
    }

    // 5️⃣ Prevent duplicate report
    const existingReport = await Report.findOne({
      where: { reporterId, targetType, targetId }
    });

    if (existingReport) {
      return res.status(409).json({
        success: false,
        message: "You already reported this"
      });
    }

    // 6️⃣ Create report
    const report = await Report.create({
      reporterId,
      targetType,
      targetId,
      reason,
      description,
      status: "pending"
    });

    // 7️⃣ Increment reportCount on target
    if (typeof target.reportCount === "number") {
      await target.increment("reportCount");
    }

    return res.status(201).json({
      success: true,
      message: "Report submitted successfully",
      report
    });

  } catch (error) {
    console.error("CREATE REPORT ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to submit report"
    });
  }
};
