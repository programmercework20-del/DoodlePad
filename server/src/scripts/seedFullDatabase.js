import { sequelize, User, Post, Comment, Report, Live, Admin } from '../models/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const seedFullDatabase = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connected.');

        // Read JSON data
        const dataPath = path.join(__dirname, '../data/dummyData.json');
        const rawData = fs.readFileSync(dataPath);
        const data = JSON.parse(rawData);

        // Sync database (force: true clears existing data - USE WITH CAUTION)
        // await sequelize.sync({ force: true }); 
        // using safe sync instead
        await sequelize.sync();

        console.log('🚀 Starting seeding process...');

        // 1. Seed Users
        console.log('🌱 Seeding Users...');
        const createdUsers = [];
        for (const user of data.users) {
            // Check if user exists
            const exists = await User.findOne({ where: { email: user.email } });
            if (!exists) {
                const newUser = await User.create(user);
                createdUsers.push(newUser);
            } else {
                createdUsers.push(exists);
            }
        }
        console.log(`✅ ${createdUsers.length} Users seeded.`);

        if (createdUsers.length === 0) {
            console.log('❌ No users available to link content. Aborting.');
            process.exit(1);
        }

        // 2. Seed Posts
        console.log('🌱 Seeding Posts...');
        const createdPosts = [];
        for (const post of data.posts) {
            // Assign random user
            const randomUser = createdUsers[Math.floor(Math.random() * createdUsers.length)];
            const newPost = await Post.create({
                ...post,
                userId: randomUser.id
            });
            createdPosts.push(newPost);
        }
        console.log(`✅ ${createdPosts.length} Posts seeded.`);

        // 3. Seed Comments
        console.log('🌱 Seeding Comments...');
        const createdComments = [];
        for (const comment of data.comments) {
            // Assign random user and random post
            const randomUser = createdUsers[Math.floor(Math.random() * createdUsers.length)];
            const randomPost = createdPosts[Math.floor(Math.random() * createdPosts.length)];

            if (randomPost) {
                const newComment = await Comment.create({
                    ...comment,
                    userId: randomUser.id,
                    postId: randomPost.id
                });
                createdComments.push(newComment);
            }
        }
        console.log(`✅ ${createdComments.length} Comments seeded.`);

        // 4. Seed Live Sessions
        console.log('🌱 Seeding Live Sessions...');
        const createdLives = [];
        for (const session of data.liveSessions) {
            const randomUser = createdUsers[Math.floor(Math.random() * createdUsers.length)];
            const liveData = { ...session, hostId: randomUser.id };

            if (session.startedAt === "NOW") {
                liveData.startedAt = new Date();
            } else {
                liveData.startedAt = new Date(Date.now() - 86400000); // 1 day ago
            }

            const newLive = await Live.create(liveData);
            createdLives.push(newLive);
        }
        console.log(`✅ ${createdLives.length} Live Sessions seeded.`);

        // 5. Seed Reports
        console.log('🌱 Seeding Reports...');
        for (const report of data.reports) {
            const randomReporter = createdUsers[Math.floor(Math.random() * createdUsers.length)];
            let targetId;

            // Find valid target ID based on type
            if (report.targetType === 'post' && createdPosts.length > 0) {
                targetId = createdPosts[Math.floor(Math.random() * createdPosts.length)].id;
            } else if (report.targetType === 'user' && createdUsers.length > 0) {
                targetId = createdUsers[Math.floor(Math.random() * createdUsers.length)].id;
            } else if (report.targetType === 'comment' && createdComments.length > 0) {
                targetId = createdComments[Math.floor(Math.random() * createdComments.length)].id;
            }

            if (targetId) {
                await Report.create({
                    ...report,
                    reporterId: randomReporter.id,
                    targetId: targetId
                });
            }
        }
        console.log('✅ Reports seeded.');

        console.log('\n🎉 Database seeding completed successfully!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error seeding database:', error);
        process.exit(1);
    }
};

seedFullDatabase();
