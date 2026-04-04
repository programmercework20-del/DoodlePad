export const calculateFeedScore = (item) => {
  const now = new Date();
  const created = new Date(item.createdAt);

  const hoursOld = (now - created) / (1000 * 60 * 60);
  const recencyScore = Math.max(0, 50 - hoursOld);

  const likeScore = item.likesCount * 2;
  const commentScore = item.commentsCount * 3;

  const verifiedBoost = item.user?.isVerified ? 20 : 0;

  const randomBoost = Math.random() * 5;

  return (
    recencyScore +
    likeScore +
    commentScore +
    verifiedBoost +
    randomBoost
  );
};