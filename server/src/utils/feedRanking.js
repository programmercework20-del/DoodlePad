export const calculateFeedScore = (item) => {

  const now = new Date();
  const created = new Date(item.createdAt);

  // 1️⃣ Recency score (newer = higher)
  const hoursOld = (now - created) / (1000 * 60 * 60);
  const recencyScore = Math.max(0, 50 - hoursOld); 
  // post loses score after 50 hours

  // 2️⃣ Engagement score
  const likeScore = item.likesCount * 2;
  const commentScore = item.commentsCount * 3;

  // 3️⃣ Verified user boost
  const verifiedBoost = item.user?.isVerified ? 20 : 0;

  // 4️⃣ Reel boost (Instagram pushes reels)
  const reelBoost = item.type === "reel" ? 15 : 0;

  // 5️⃣ Random freshness (avoid same feed)
  const randomBoost = Math.random() * 5;

  return (
    recencyScore +
    likeScore +
    commentScore +
    verifiedBoost +
    reelBoost +
    randomBoost
  );
};
