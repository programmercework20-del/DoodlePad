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

    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false, // VERY IMPORTANT FOR AWS RDS
      },
    },
  }
);

export default sequelize;
