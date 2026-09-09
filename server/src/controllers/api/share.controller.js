import Share from "../../models/Share.js";
import Post from "../../models/Post.js";
import User from "../../models/User.js";
import sequelize from "../config/db.js"; 

// =====================================================
// 1. RECORD SHARE & GENERATE URL (POST)
// =====================================================
export const sharePost = async (req, res) => {
  const transaction = await sequelize.transaction(); // Pro-level safety
  try {
    const userId = req.user.id;
    const { targetUserId, type = "external" } = req.body;
    const postId = req.params.id;

    if (!postId) {
      return res.status(400).json({ success: false, message: "Post ID is required" });
    }

    const post = await Post.findByPk(postId, { transaction });
    if (!post) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    // 1. Log the share
    await Share.create({
      postId,
      userId,
      targetUserId: targetUserId || null,
      type
    }, { transaction });

    // 2. Increment count safely
    await post.increment("sharesCount", { transaction });
    await transaction.commit();

    // 3. Generate the Pro-level share URL (Change domain based on environment)
    // Ye link FE developer React Native me Share API ke through bhejega
    const backendDomain = process.env.API_BASE_URL || "https://api.doodlepad.in"; // Tumhara actual backend domain
    const shareUrl = `${backendDomain}/api/share/p/${postId}`;

    return res.json({
      success: true,
      message: "Post shared successfully",
      data: {
        shareUrl,
        sharesCount: post.sharesCount + 1
      }
    });

  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    console.error("🔥 POST SHARE ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to process share request" });
  }
};


// =====================================================
// 2. HANDLE OPENING THE SHARED LINK (GET) - THE BUG FIX!
// =====================================================
export const handleSharedLink = async (req, res) => {
  try {
    const postId = req.params.id;
    
    // Fetch post details for the WhatsApp Preview Card
    const post = await Post.findByPk(postId, {
      include: [{ model: User, as: 'author', attributes: ['name', 'username', 'profilePhoto'] }]
    });

    if (!post) {
       return res.status(404).send("<h1>Oops! This post is no longer available.</h1>");
    }

    // 1. Data for Open Graph (WhatsApp Preview Metadata)
    const title = `DoodlePad: Post by ${post.author?.name || 'User'}`;
    const description = post.caption ? post.caption.substring(0, 100) + "..." : "Check out this amazing post on DoodlePad!";
    // Make sure you replace 'mediaUrl' with whatever field holds your post image
    const imageUrl = post.doodleImage || post.author?.profilePhoto || 'https://yourwebsite.com/default-logo.png'; 

    // 2. HTML Template generating Meta Tags & Deep Link JS
    const htmlPreview = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        
        <!-- 🔥 MAGIC FOR WHATSAPP/INSTA PREVIEWS -->
        <meta property="og:type" content="website">
        <meta property="og:url" content="https://api.doodlepad.in/api/share/p/${postId}">
        <meta property="og:title" content="${title}">
        <meta property="og:description" content="${description}">
        <meta property="og:image" content="${imageUrl}">
        
        <!-- 🔥 MAGIC TO OPEN MOBILE APP AUTOMATICALLY -->
        <script>
            window.onload = function() {
                // Fe dev ko bolna React Native me ye scheme handle kare
                var appScheme = "doodlepad://post/${postId}"; 
                var playStoreUrl = "https://play.google.com/store/apps/details?id=com.programmerce.doodlepad";
                
                // 1. Pehle App open karne ki koshish karo
                window.location.href = appScheme;
                
                // 2. Agar app phone me nahi hai, toh 2 second baad Play Store bhej do
                setTimeout(function() {
                    window.location.href = playStoreUrl;
                }, 2000);
            };
        </script>
    </head>
    <body style="font-family: Arial, sans-serif; text-align: center; padding-top: 50px; background-color: #f4f4f4;">
        <h2>Opening DoodlePad... 🎨</h2>
        <p>If you are not redirected automatically, <a href="https://play.google.com/store/apps/details?id=com.programmerce.doodlepad">click here to download our app</a>.</p>
    </body>
    </html>
    `;

    // 3. Return this HTML to the browser/WhatsApp crawler!
    res.setHeader('Content-Type', 'text/html');
    return res.send(htmlPreview);

  } catch (error) {
    console.error("🔥 SHARE LINK PREVIEW ERROR:", error);
    res.status(500).send("<h1>Something went wrong</h1>");
  }
};