import admin from "firebase-admin";

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  storageBucket: "doodlepad-media-staging"
});

// 👇 Ye line ensure karegi ki bucket hi export ho
const bucket = admin.storage().bucket();

export default bucket;