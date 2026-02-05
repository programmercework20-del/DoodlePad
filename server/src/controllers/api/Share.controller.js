import Share from "../../models/Share.js";
import Post from "../../models/Post.js";

export const sharePost = async (req,res)=>{
  try{
    const userId = req.user.id;
    const postId = req.params.id;
    const { type, targetUserId } = req.body;

    const post = await Post.findByPk(postId);
    if(!post){
      return res.status(404).json({message:"Post not found"});
    }

    await Share.create({
      postId,
      userId,
      type,
      targetUserId: targetUserId || null
    });

    // increase share count
    await post.increment("sharesCount");

    res.json({
      success:true,
      message:"Post shared successfully"
    });

  }catch(err){
    res.status(500).json({error:err.message});
  }
};
