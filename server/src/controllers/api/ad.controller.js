import Ad from "../../models/Ad.js";
import redisClient from "../../config/redis.js";
import { bucket } from "../../config/firebase.js"; 
import sequelize from "../../config/db.js";

// ============================================================
// 1. CREATE AD (With GCS Bucket Upload & Cache Eviction)
// ============================================================
export const createAd = async (req, res) => {
  try {
    const {
       advertiserName,
       advertiserEmail,
       title,
       description,
       redirectUrl,
       buttonText,
       budget,
       startDate,
       endDate
    } = req.body;

    let imageUrl = null;

    if (req.file) {
      const fileName = `ads_media/ad_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const blob = bucket.file(fileName);
      
      await blob.save(req.file.buffer, {
        metadata: { contentType: req.file.mimetype },
        resumable: false 
      });
      
      imageUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    }

    const ad = await Ad.create({
      advertiserName,
      advertiserEmail,
      title,
      description,
      imageUrl,
      redirectUrl,
      buttonText: buttonText || "Learn More",
      budget,
      startDate,
      endDate,
      status: "active"
    });

    if (redisClient?.isReady) {
      await redisClient.del("active_ads").catch(e => console.error("Redis Del Error:", e));
    }

    return res.status(201).json({
      success: true,
      ad
    });

  } catch (error) {
    console.error("🔥 CREATE AD ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create ad",
      error: error.message
    });
  }
};

// ============================================================
// 2. GET ADS (With 5 Minutes Redis Cache Feed)
// ============================================================
export const getAds = async (req, res) => {
  try {
    const cacheKey = "active_ads";

    if (redisClient?.isReady) {
      try {
        const cachedAds = await redisClient.get(cacheKey);
        if (cachedAds) {
          return res.json({
            success: true,
            ads: JSON.parse(cachedAds)
          });
        }
      } catch (cacheErr) {
        console.error("⚠️ Redis Read Error (Falling back to DB):", cacheErr.message);
      }
    }

    const ads = await Ad.findAll({
      where: { status: "active" }, // Live standard query verification
      order: [["createdAt", "DESC"]]
    });

    if (redisClient?.isReady && ads.length > 0) {
      await redisClient.setEx(cacheKey, 300, JSON.stringify(ads)).catch(() => {});
    }

    return res.json({
      success: true,
      ads
    });

  } catch (error) {
    console.error("🔥 GET ADS ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch ads" });
  }
};

// ============================================================
// 3. DELETE AD (With Dynamic File & Cache Purge)
// ============================================================
export const deleteAd = async (req, res) => {
  try {
    const ad = await Ad.findByPk(req.params.id);

    if (!ad) {
      return res.status(404).json({ message: "Ad not found" });
    }

    if (ad.imageUrl) {
      try {
        const fileUri = ad.imageUrl.split(`${bucket.name}/`)[1];
        if (fileUri) {
          await bucket.file(fileUri).delete();
          console.log(`🗑️ Deleted image from bucket: ${fileUri}`);
        }
      } catch (gcsErr) {
        console.error("⚠️ Failed to delete GCS asset:", gcsErr.message);
      }
    }

    await ad.destroy();

    if (redisClient?.isReady) {
      await redisClient.del("active_ads").catch(() => {});
    }

    return res.json({
      success: true,
      message: "Ad deleted"
    });

  } catch (error) {
    console.error("🔥 DELETE AD ERROR:", error);
    return res.status(500).json({ success: false, message: "Delete failed" });
  }
};

// ============================================================
// 4. TRACK CLICK (Safe Postgres Atomic Literal Format)
// ============================================================
export const trackClick = async (req, res) => {
  try {
    const { id } = req.params;

    // 🔥 FIXED: Standardized Postgres target parameter to avoid casing mismatches
    const [updatedCount] = await Ad.update(
      { clicks: sequelize.literal('clicks + 1') },
      { where: { id } }
    );

    if (updatedCount === 0) {
      return res.status(404).json({ success: false, message: "Ad not found" });
    }

    return res.json({ success: true });

  } catch (error) {
    console.error("🔥 TRACK CLICK ERROR:", error);
    return res.status(500).json({ success: false, message: "Click tracking failed" });
  }
};

// ============================================================
// 5. TRACK IMPRESSION (Safe Postgres Atomic Literal Format)
// ============================================================
export const trackImpression = async (req, res) => {
  try {
    const { id } = req.params;

    // 🔥 FIXED: Standardized Postgres target parameter to avoid casing mismatches
    const [updatedCount] = await Ad.update(
      { impressions: sequelize.literal('impressions + 1') },
      { where: { id } }
    );

    if (updatedCount === 0) {
      return res.status(404).json({ success: false, message: "Ad not found" });
    }

    return res.json({ success: true });

  } catch (error) {
    console.error("🔥 TRACK IMPRESSION ERROR:", error);
    return res.status(500).json({ success: false, message: "Impression tracking failed" });
  }
};