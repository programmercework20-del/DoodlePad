import CloseFriend from "../../models/CloseFriend.js";

/* ADD CLOSE FRIEND */
export const addCloseFriend = async (req, res) => {
  try {
    const { friendId } = req.body;

    if (!friendId) {
      return res.status(400).json({ message: "friendId is required" });
    }

    await CloseFriend.findOrCreate({
      where: {
        userId: req.user.id,
        friendId
      }
    });

    res.json({ success: true, message: "Added to close friends" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to add close friend" });
  }
};

/* REMOVE CLOSE FRIEND */
export const removeCloseFriend = async (req, res) => {
  try {
    const { friendId } = req.body;

    await CloseFriend.destroy({
      where: {
        userId: req.user.id,
        friendId
      }
    });

    res.json({ success: true, message: "Removed from close friends" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to remove close friend" });
  }
};

/* GET MY CLOSE FRIENDS */
export const getMyCloseFriends = async (req, res) => {
  try {
    const list = await CloseFriend.findAll({
      where: { userId: req.user.id }
    });

    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch close friends" });
  }
};
