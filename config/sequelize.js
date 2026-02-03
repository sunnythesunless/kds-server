/**
 * Sequelize Configuration for InsightOps
 * Supports SQLite (dev) and PostgreSQL (prod)
 */
const { Sequelize } = require('sequelize');
const path = require('path');

let sequelize;

if (process.env.DB_DIALECT === 'postgres') {
    sequelize = new Sequelize(
        process.env.DB_NAME,
        process.env.DB_USER,
        process.env.DB_PASSWORD,
        {
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            dialect: 'postgres',
            logging: process.env.NODE_ENV === 'development' ? console.log : false,
            pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
        }
    );
} else {
    // SQLite for development
    const dbPath = process.env.DB_STORAGE || path.resolve(process.cwd(), 'data', 'insightops.db');
    sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: dbPath,
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
    });
}

async function testConnection() {
    try {
        await sequelize.authenticate();
        console.log('✓ Sequelize (InsightOps DB) connected');
        return true;
    } catch (error) {
        console.error('✗ Sequelize connection failed:', error.message);
        return false;
    }
}

module.exports = { sequelize, testConnection };
