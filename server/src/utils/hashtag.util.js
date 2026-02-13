import Hashtag from "../models/Hashtag.js";
import HashtagUsage from "../models/HashtagUsage.js";

export const processHashtags = async ({ caption, reelId=null, postId=null }) => {
  if (!caption) return;

  const matches = caption.match(/#[a-zA-Z0-9_]+/g);
  if (!matches) return;

  for (let tag of matches) {
    const name = tag.replace("#","").toLowerCase();

    const [hashtag] = await Hashtag.findOrCreate({
      where:{ name },
      defaults:{ postsCount:0 }
    });

    // increment count
    await hashtag.increment("postsCount");

    // link usage
    await HashtagUsage.create({
      hashtagId: hashtag.id,
      reelId,
      postId
    });
  }
};
