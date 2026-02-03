const mongoose = require('mongoose');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const seed = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/insightops');
        console.log('Connected to DB');

        // Clear existing
        await User.deleteMany({ email: 'test@example.com' });

        // Create User
        // Manually hashing since we might bypass hook or just to be safe
        const hashedPassword = await bcrypt.hash('password123', 12);
        const user = await User.create({
            name: 'Test Tester',
            email: 'test@example.com',
            password: hashedPassword,
            role: 'user', // System role
            provider: 'local',
            isVerified: true
        });

        // Create Workspace
        await Workspace.create({
            name: 'Verification Labs',
            owner: user._id,
            members: [{ user: user._id, role: 'admin' }], // Workspace Admin
            plan: 'pro'
        });

        console.log('Seed Successful: test@example.com / password123');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

seed();
