import { Op, literal } from "sequelize";
import Post from "../../models/Post.js";
import Reel from "../../models/Reel.js";
import User from "../../models/User.js";
import Follower from "../../models/Follower.js";

export const getExploreFeed = async (req,res)=>{
  try{
    const userId = req.user.id;
    const limit = 12;
    const cursor = req.query.cursor || null;

    // 1️⃣ Get following list
    const following = await Follower.findAll({
      where:{ follower_id:userId },
      attributes:["following_id"]
    });

    const followingIds = following.map(f=>f.following_id);
    followingIds.push(userId); // exclude own content

    // Cursor pagination condition
    const cursorCondition = cursor
      ? { createdAt:{ [Op.lt]: new Date(cursor) } }
      : {};

    // ================= POSTS =================
    const posts = await Post.findAll({
      where:{
        userId:{ [Op.notIn]: followingIds },
        status:"active",
        ...cursorCondition
      },

      include:[{
        model:User,
        as:"author",
        attributes:["id","username","profilePhoto"]
      }],

      attributes:{
        include:[
          [literal(`"likesCount" * 3`),"likeScore"],
          [literal(`"commentsCount" * 4`),"commentScore"],
          [literal(`"sharesCount" * 5`),"shareScore"],
          [literal(`EXTRACT(EPOCH FROM (NOW() - "Post"."createdAt")) / 3600`),"hoursOld"],

          // final score
          [literal(`
            ("likesCount"*3 + "commentsCount"*4 + "sharesCount"*5)
            - (EXTRACT(EPOCH FROM (NOW() - "Post"."createdAt")) / 3600)
          `),"score"]
        ]
      },

      order:[[literal("score"),"DESC"]],
      limit
    });

    // ================= REELS =================
    const reels = await Reel.findAll({
      where:{
        userId:{ [Op.notIn]: followingIds },
        status:"active",
        ...cursorCondition
      },

      include:[{
        model:User,
        as:"author",
        attributes:["id","username","profilePhoto"]
      }],

      attributes:{
        include:[
          [literal(`"likesCount" * 3`),"likeScore"],
          [literal(`"commentsCount" * 3`),"commentScore"],
          [literal(`"sharesCount" * 5`),"shareScore"],
          [literal(`"viewsCount" * 2`),"viewScore"],

          [literal(`
            ("likesCount"*3 + "commentsCount"*3 + "sharesCount"*5 + "viewsCount"*2)
          `),"score"]
        ]
      },

      order:[[literal("score"),"DESC"]],
      limit
    });

    // ================= NORMALIZE =================
    const formattedPosts = posts.map(p=>({
      id:p.id,
      type:"post",
      mediaUrl:p.mediaUrl,
      caption:p.caption,
      createdAt:p.createdAt,
      score:p.dataValues.score,
      user:p.author
    }));

    const formattedReels = reels.map(r=>({
      id:r.id,
      type:"reel",
      mediaUrl:r.videoUrl,
      caption:r.caption,
      createdAt:r.createdAt,
      score:r.dataValues.score,
      user:r.author
    }));

    // ================= MERGE + SORT =================
    const explore = [...formattedPosts,...formattedReels]
      .sort((a,b)=> b.score - a.score)
      .slice(0,limit);

    const nextCursor = explore.length
      ? explore[explore.length-1].createdAt
      : null;

    res.json({
      success:true,
      explore,
      nextCursor
    });

  }catch(err){
    console.error("Explore error:",err);
    res.status(500).json({message:"Failed to load explore"});
  }
};
