// import admin from "firebase-admin";

// admin.initializeApp({
//   credential: admin.credential.applicationDefault(),
//   storageBucket: "doodlepad-media-staging"
// });

// // 👇 Ye line ensure karegi ki bucket hi export ho
// const bucket = admin.storage().bucket();

import admin from "firebase-admin";
import fs from "fs";
import { fileURLToPath } from 'url';
import path from 'path';

//  Live Server Path Fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log(" Loading Firebase Admin Config for Production...");

let serviceAccount;

try {
  // Path ko absolute banaya taaki live server par error na aaye
  const keyPath = path.join(__dirname, "firebaseServiceKey.json");
  console.log(`📂 Reading key from: ${keyPath}`);
  
  serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf8"));
  console.log("✅ Service Account Loaded");
} catch (error) {
  console.error(" ERROR loading firebaseServiceKey.json:", error.message);
  // Live server par crash hone se bachane ke liye handle karein
}

try {
  if (!admin.apps.length) {
    console.log("🚀 Initializing Firebase Admin...");

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      //  Is line ko check kar lena aapka bucket name yahi hai na
      storageBucket: "doodlepad-media-staging" 
    });

    console.log(" Firebase Initialized Successfully");
  } else {
    console.log(" Firebase already initialized");
  }
} catch (error) {
  console.error(" Firebase Initialization Error:", error.message);
}

// 🛰️ Exports
const bucket = admin.storage().bucket();
const auth = admin.auth(); // Direct auth instance

export { admin, bucket, auth };
export default admin;