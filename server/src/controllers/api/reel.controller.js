import Reel from "../../models/Reel.js";
import { getVideoDuration } from "../../utils/getVideoDuration.js";

export const createReel = async (req, res) => {
    try {
        const userId = req.user.id;

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Video file is required"
            });
        }

        const caption = req.body.caption || "";
        const videoPath = req.file.path;

        let duration = await getVideoDuration(videoPath);
        duration = Math.floor(duration); // 🔥 convert to seconds integer


        // console.log("Final duration:", duration);
        // console.log("Detected duration:", duration);

        // 🎯 VALIDATION: 3 sec – 60 sec
        if (duration < 3 || duration > 60) {
            return res.status(400).json({
                success: false,
                message: "Reel must be between 3 and 60 seconds"
            });
        }

        const reel = await Reel.create({
            userId,
            videoUrl: `/uploads/${req.file.filename}`,
            caption,
            duration
        });

        return res.status(201).json({
            success: true,
            message: "Reel uploaded successfully",
            reel
        });

    } catch (error) {
        console.error("Create reel error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to upload reel"
        });
    }
};


export const deleteReel = async (req, res) => {
    try {
        const reelId = req.params.id;
        const userId = req.user.id;

        const reel = await Reel.findByPk(reelId);

        if (!reel) return res.status(404).json({ message: "Reel not found" });

        if (reel.userId !== userId)
            return res.status(403).json({ message: "Not allowed" });

        await reel.update({ status: "deleted" });

        res.json({ success: true, message: "Reel deleted" });

    } catch (error) {
        res.status(500).json({ message: "Failed to delete reel" });
    }
};

export const getUserReels = async (req, res) => {
    try {
        const userId = req.params.id;

        const reels = await Reel.findAll({
            where: { userId, status: "active" },
            order: [["createdAt", "DESC"]]
        });

        res.json({ success: true, reels });

    } catch (error) {
        res.status(500).json({ message: "Failed to fetch reels" });
    }
};
