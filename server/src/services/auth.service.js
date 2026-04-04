import admin from "../config/firebase.js";
import { User } from "../models/index.js";
import jwt from "jsonwebtoken";

export const handleGoogleLogin = async (idToken) => {
  // 🔥 Verify Firebase token
  const decoded = await admin.auth().verifyIdToken(idToken);

  const { uid, email, name, picture } = decoded;

  if (!email) {
    throw new Error("Google account has no email");
  }

  // 🔍 Find existing user
  let user = await User.findOne({
    where: { email }
  });

  // 🟢 CASE 1: New User
  if (!user) {
    user = await User.create({
      email,
      name,
      profilePhoto: picture,
      googleId: uid,
      provider: "google",
      isVerified: true
    });
  }

  // 🟡 CASE 2: Existing Email User (merge account)
  else if (!user.googleId) {
    await user.update({
      googleId: uid,
      provider: "google",
      isVerified: true
    });
  }

  // 🔴 CASE 3: Blocked user
  if (user.status !== "active") {
    throw new Error("Account blocked");
  }

  // 🔐 Generate YOUR JWT
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