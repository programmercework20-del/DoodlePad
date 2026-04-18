import admin from "../config/firebase.js";
import { User } from "../models/index.js";
import jwt from "jsonwebtoken";

export const handleGoogleLogin = async (idToken) => {
  const decoded = await admin.auth().verifyIdToken(idToken);

  console.log("🔥 DECODED TOKEN:", decoded); // DEBUG

  const uid = decoded.uid;
  const email = decoded.email;
  const name = decoded.name || "";
  const picture = decoded.picture || "";

  if (!email) {
    throw new Error("Google account has no email");
  }

  let user = await User.findOne({
    where: { email }
  });

  if (!user) {
    user = await User.create({
      email,
      name,
      username: email.split("@")[0], // ✅ auto username
      password: null, // ✅ google user
      profilePhoto: picture,
      googleId: uid,
      provider: "google",
      isVerified: true
    });
  } else if (!user.googleId) {
    await user.update({
      googleId: uid,
      provider: "google",
      isVerified: true
    });
  }

  if (user.status !== "active") {
    throw new Error("Account blocked");
  }

  const token = jwt.sign(
    { id: user.id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      profilePhoto: user.profilePhoto
    }
  };
};