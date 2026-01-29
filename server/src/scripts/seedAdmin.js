import bcrypt from 'bcrypt';
import { Admin, sequelize } from '../models/index.js';

const seedAdmin = async () => {
    try {
        // Connect to database
        await sequelize.authenticate();
        console.log("✅ Database connection established.");

        // Sync models
        await sequelize.sync();
        console.log("✅ Models synchronized.");

        // Check if admin already exists
        const existingAdmin = await Admin.findOne({
            where: { email: "admin@example.com" }
        });

        if (existingAdmin) {
            console.log("⚠️  Admin user already exists!");
            process.exit(0);
        }

        // Hash password
        const hashedPassword = await bcrypt.hash("Admin@123", 10);

        // Create admin user
        const admin = await Admin.create({
            email: "admin@example.com",
            password: hashedPassword,
            name: "Admin User",
            role: "super_admin",
            isActive: true
        });

        console.log("✅ Admin user created successfully!");
        console.log("\n📧 Email: admin@example.com");
        console.log("🔑 Password: Admin@123");
        console.log("\n⚠️  Please change the password after first login!\n");

        process.exit(0);
    } catch (error) {
        console.error("❌ Error seeding admin:", error);
        process.exit(1);
    }
};

seedAdmin();
