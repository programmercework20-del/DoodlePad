import Reel from "../../models/Reel.js";
import ReelComment from "../../models/ReelComment.js";
import ReelCommentLike from "../../models/ReelCommentLike.js";


export const addReelComment = async (req,res)=>{
  try{
    const userId = req.user.id;
    const { reelId } = req.params;
    const { type, content } = req.body;

    let mediaUrl = null;
    if(req.file){
      mediaUrl = `/uploads/${req.file.filename}`;
    }

    const reel = await Reel.findByPk(reelId);
    if(!reel){
      return res.status(404).json({message:"Reel not found"});
    }

    const comment = await ReelComment.create({
      reelId,
      userId,
      type,
      content,
      mediaUrl
    });

    await reel.increment("commentsCount");

    res.status(201).json({
      success:true,
      message:"Reel comment added",
      comment
    });

  }catch(err){
    console.error(err);
    res.status(500).json({message:"Failed to add reel comment"});
  }
};


export const getReelComments = async (req,res)=>{
  try{
    const { reelId } = req.params;

    const comments = await ReelComment.findAll({
      where:{ reelId, status:"active" },
      include:[
        {
          model: User,
          as:"user",
          attributes:["id","username","profilePhoto"]
        }
      ],
      order:[["createdAt","DESC"]]
    });

    res.json({success:true,comments});

  }catch(err){
    res.status(500).json({message:"Failed to fetch reel comments"});
  }
};

export const deleteReelComment = async (req,res)=>{
  try{
    const userId = req.user.id;
    const { commentId } = req.params;

    const comment = await ReelComment.findByPk(commentId);

    if(comment.userId !== userId){
      return res.status(403).json({message:"Not allowed"});
    }

    comment.status = "deleted";
    await comment.save();

    const reel = await Reel.findByPk(comment.reelId);
    await reel.decrement("commentsCount");

    res.json({success:true,message:"Comment deleted"});

  }catch(err){
    res.status(500).json({message:"Failed"});
  }
};

export const likeReelComment = async (req,res)=>{
  try{
    const userId = req.user.id;
    const { commentId } = req.params;

    const comment = await ReelComment.findByPk(commentId);
    if(!comment){
      return res.status(404).json({message:"Comment not found"});
    }

    // 🔥 FIXED COLUMN NAME HERE
    const existing = await ReelCommentLike.findOne({
      where:{ commentId: commentId, userId }
    });

    if(existing){
      await existing.destroy();
      await comment.decrement("likesCount");
      return res.json({message:"Comment unliked"});
    }

    // 🔥 FIXED COLUMN NAME HERE ALSO
    await ReelCommentLike.create({
      commentId: commentId,
      userId
    });

    await comment.increment("likesCount");

    res.json({message:"Comment liked"});

  }catch(err){
    console.error(err);
    res.status(500).json({message:"Like failed"});
  }
};

