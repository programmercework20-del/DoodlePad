import { Op, literal } from "sequelize";
import Reel from "../../models/Reel.js";
import ReelView from "../../models/ReelView.js";
import User from "../../models/User.js";
import Follower from "../../models/Follower.js";

export const getReelsFeed = async (req,res)=>{
  try{
    const userId = req.user.id;

    // 1️⃣ Get following list
    const following = await Follower.findAll({
      where:{ follower_id:userId },
      attributes:["following_id"]
    });

    const followingIds = following.map(f=>f.following_id);

    // 2️⃣ Fetch reels with ranking score
    const reels = await Reel.findAll({
      where:{ status:"active" },
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
          // 🔥 WATCH TIME SCORE
          [literal(`COALESCE("ReelViews"."watchTime",0) * 5`),"watchScore"],

          // 🔥 REWATCH SCORE
          [literal(`COALESCE("ReelViews"."rewatchCount",0) * 4`),"rewatchScore"],

          // 🔥 ENGAGEMENT SCORE
          [literal(`"Reel"."likesCount" * 3`),"likeScore"],
          [literal(`"Reel"."commentsCount" * 2`),"commentScore"],
          [literal(`"Reel"."viewsCount"`),"viewScore"],

          // 🔥 FOLLOWING BONUS
          [literal(`
            CASE 
              WHEN "Reel"."userId" IN (${followingIds.length ? `'${followingIds.join("','")}'` : "NULL"})
              THEN 30 ELSE 0 END
          `),"followingScore"],

          // 🔥 RECENCY BONUS (new reels boosted)
          [literal(`
            CASE
              WHEN "Reel"."createdAt" > NOW() - INTERVAL '1 day' THEN 20
              WHEN "Reel"."createdAt" > NOW() - INTERVAL '3 day' THEN 10
              ELSE 0 END
          `),"recencyScore"],

          // 🔥 FINAL TOTAL SCORE
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
      limit:10
    });

    res.json({
      success:true,
      reels
    });

  }catch(err){
    console.error("Reels feed error:",err);
    res.status(500).json({message:"Failed to load reels"});
  }
};
