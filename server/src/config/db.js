// import { Sequelize } from "sequelize";
// import config from "./env.js";

// console.log("🔥 DB CONFIG FILE LOADED");

// const sequelize = new Sequelize(
//   config.db.name,
//   config.db.user,
//   config.db.password,
//   {
//     host: config.db.host,
//     port: config.db.port,
//     dialect: "postgres",
//     logging: false,

//     dialectOptions: {
//       ssl: {
//         require: true,
//         rejectUnauthorized: false, // VERY IMPORTANT FOR AWS RDS
//       },
//     },
//   }
// );

// export default sequelize;

import { Sequelize } from "sequelize";
import config from "./env.js";

console.log("🔥 DB CONFIG FILE LOADED");

const sequelize = new Sequelize(
  config.db.name,
  config.db.user,
  config.db.password,
  {
    host: config.db.host,
    port: config.db.port,
    dialect: "postgres",
    logging: false,
    
    // 🔥 YAHAN SE NAYA CODE ADD HUA HAI (CONNECTION POOL)
    pool: {
      max: 50,        // Ek waqt par 50 log bina wait kiye DB se data le payenge (Stoves ki ginti 5 se 50 kar di)
      min: 5,         // Server start hote hi 5 connections hamesha ready rakhega
      acquire: 60000, // Agar traffic zyada ho, toh turant fail hone ke bajaye 60 sec tak connection ka wait karega
      idle: 10000     // Agar koi connection 10 sec tak khaali pada hai, toh use band kar dega memory bachane ke liye
    },
    // 🔥 NAYA CODE KHATAM

    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false, // VERY IMPORTANT FOR AWS RDS
      },
    },
  }
);

export default sequelize;