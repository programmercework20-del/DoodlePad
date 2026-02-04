import Post from "../../models/Post.js";

export const createPost = async (req, res) => {
    console.log("data mila:", req.body)
  try {
    const userId = req.user.id;
    const { type, caption, content } = req.body;

    let mediaUrl = null;

    if (req.file) {
      mediaUrl = `/uploads/${req.file.filename}`;
    }

    // Validation
    const allowedTypes = ["image", "video", "audio", "doodle", "text", "live"];
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ success: false, message: "Invalid post type" });
    }

    if (["image", "video", "audio", "doodle"].includes(type) && !mediaUrl) {
      return res.status(400).json({
        success: false,
        message: "File is required for this post type"
      });
    }

    if (type === "text" && !content) {
      return res.status(400).json({
        success: false,
        message: "content is required for text post"
      });
    }

    const post = await Post.create({
      userId,
      type,
      content,
      caption,
      mediaUrl
    });

    return res.status(201).json({
      success: true,
      message: "Post created successfully",
      post
    });

  } catch (error) {
    console.error("Create post error:", error);
    res.status(500).json({ success: false, message: "Failed to create post" });
  }
};

export const deletePost = async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.id;

    // 1. Find Post
    const post = await Post.findByPk(postId);

    if(!post){
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }

    // 2.check ownership

    if(post.userId !== userId){
      return res.json(403).json({
        success: false,
        message: "you are not allowed to delete this post"
      });
    }

    // 2. Already deleted?

    if(post.userId === "deleted"){
      return res.json(400).json({
        success: false,
        message: "post already deleted"
      });
    }

    await post.update({status: "deleted"});

    return res.json({
      success: true,
      message: "Post deleted successfully"
    });
    
  } catch (error) {
     console.error("Delete post error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete post"
    });
  }
}
