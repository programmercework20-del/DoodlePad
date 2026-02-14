import { Op, literal } from "sequelize";
import Reel from "../../models/Reel.js";
import ReelView from "../../models/ReelView.js";
import User from "../../models/User.js";
import Follower from "../../models/Follower.js";

export const getReelsFeed = async (req,res)=>{
  try{
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;
    const cursor = req.query.cursor; // 🔥 cursor comes from frontend

    /* 1️⃣ Get following list */
    const following = await Follower.findAll({
      where:{ follower_id:userId },
      attributes:["following_id"]
    });

    const followingIds = following.map(f=>f.following_id);

    /* 2️⃣ Cursor condition (INFINITE SCROLL MAGIC) */
    const cursorCondition = cursor
      ? { createdAt: { [Op.lt]: new Date(cursor) } }
      : {};

    /* 3️⃣ Fetch reels with FULL ranking + pagination */
    const reels = await Reel.findAll({
      where:{
        status:"active",
        ...cursorCondition
      },

      include:[
        {
          model:User,
          as:"author",
          attributes:["id","username","profilePhoto"]
        },
        {
          model:ReelView,
          required:false,
          where:{ userId },
          attributes:[]
        }
      ],

      attributes:{
        include:[
          [literal(`COALESCE("ReelViews"."watchTime",0) * 5`),"watchScore"],
          [literal(`COALESCE("ReelViews"."rewatchCount",0) * 4`),"rewatchScore"],
          [literal(`"Reel"."likesCount" * 3`),"likeScore"],
          [literal(`"Reel"."commentsCount" * 2`),"commentScore"],
          [literal(`"Reel"."viewsCount"`),"viewScore"],

          [literal(`
            CASE 
              WHEN "Reel"."userId" IN (${followingIds.length ? `'${followingIds.join("','")}'` : "NULL"})
              THEN 30 ELSE 0 END
          `),"followingScore"],

          [literal(`
            CASE
              WHEN "Reel"."createdAt" > NOW() - INTERVAL '1 day' THEN 20
              WHEN "Reel"."createdAt" > NOW() - INTERVAL '3 day' THEN 10
              ELSE 0 END
          `),"recencyScore"],

          [literal(`
            (
              COALESCE("ReelViews"."watchTime",0) * 5 +
              COALESCE("ReelViews"."rewatchCount",0) * 4 +
              "Reel"."likesCount" * 3 +
              "Reel"."commentsCount" * 2 +
              "Reel"."viewsCount" +
              CASE 
                WHEN "Reel"."userId" IN (${followingIds.length ? `'${followingIds.join("','")}'` : "NULL"})
                THEN 30 ELSE 0 END +
              CASE
                WHEN "Reel"."createdAt" > NOW() - INTERVAL '1 day' THEN 20
                WHEN "Reel"."createdAt" > NOW() - INTERVAL '3 day' THEN 10
                ELSE 0 END
            )
          `),"score"]
        ]
      },

      order:[[literal(`score`),"DESC"]],
      limit
    });

    /* 4️⃣ CREATE NEXT CURSOR */
    const nextCursor = reels.length > 0
      ? reels[reels.length - 1].createdAt
      : null;

    /* 5️⃣ FINAL RESPONSE */
    res.json({
      success:true,
      reels,
      nextCursor,
      hasMore: reels.length === limit
    });

  }catch(err){
    console.error("Reels feed error:",err);
    res.status(500).json({message:"Failed to load reels"});
  }
};
