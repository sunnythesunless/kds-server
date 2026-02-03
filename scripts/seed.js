const mongoose = require('mongoose');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
require('dotenv').config({ path: '../.env' }); // Load env from parent

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected for Seeding');
    } catch (err) {
        console.error('MongoDB Connection Failed:', err);
        process.exit(1);
    }
};

const seed = async () => {
    await connectDB();

    // Clear existing data (optional, be careful in prod!)
    // await User.deleteMany({});
    // await Workspace.deleteMany({});

    try {
        // 1. Create Admin User
        const adminEmail = 'admin@insightops.com';
        let adminUser = await User.findOne({ email: adminEmail });

        if (!adminUser) {
            adminUser = await User.create({
                name: 'Admin User',
                email: adminEmail,
                password: 'password123', // Will be hashed by pre-save hook
                role: 'admin',
                isVerified: true
            });
            console.log('✅ Created Admin User');
        } else {
            console.log('ℹ️ Admin User already exists');
        }

        // 2. Create Default Workspace
        const workspaceName = 'Engineering';
        let workspace = await Workspace.findOne({ name: workspaceName });

        if (!workspace) {
            workspace = await Workspace.create({
                name: workspaceName,
                owner: adminUser._id,
                members: [{ user: adminUser._id, role: 'admin' }]
            });
            console.log(`✅ Created Workspace: ${workspaceName}`);
            console.log(`🔑 Workspace ID: ${workspace._id}`);
        } else {
            console.log(`ℹ️ Workspace '${workspaceName}' already exists. ID: ${workspace._id}`);
        }

    } catch (err) {
        console.error('Seeding Error:', err);
    } finally {
        mongoose.connection.close();
        process.exit();
    }
};

seed();
