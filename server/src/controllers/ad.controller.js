// import Ad from "../../models/Ad.js";

// // ✅ Create Ad
// export const createAd = async (req, res) => {
//   try {
//     const { title, imageUrl, redirectUrl } = req.body;

//     const ad = await Ad.create({
//       title,
//       imageUrl,
//       redirectUrl
//     });

//     res.json({
//       success: true,
//       message: "Ad created",
//       ad
//     });

//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Failed to create ad" });
//   }
// };

// // ✅ Get Ads
// export const getAds = async (req, res) => {
//   const ads = await Ad.findAll({
//     order: [["createdAt", "DESC"]]
//   });

//   res.json({
//     success: true,
//     ads
//   });
// };

// // ✅ Delete Ad
// export const deleteAd = async (req, res) => {
//   const { id } = req.params;

//   await Ad.destroy({ where: { id } });

//   res.json({
//     success: true,
//     message: "Ad deleted"
//   });
// };