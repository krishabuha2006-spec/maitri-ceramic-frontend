const mongoose = require('mongoose');
const dns = require('dns');

const connectDB = async () => {
    // Reuse existing connection if already connected (vital for serverless cold/warm starts)
    if (mongoose.connection.readyState >= 1) {
        return mongoose.connection;
    }

    let dbUri =
        process.env.MONGODB_URI ||
        'mongodb+srv://laxsavani:laxsavani@cluster0.ykxfhke.mongodb.net/Maitri-Cermic';

    // Sanitize any extra quotes or trailing semicolons
    dbUri = dbUri.trim().replace(/^['"]|['"]$/g, '').replace(/;+$/, '');

    // Configure public DNS resolvers for reliable MongoDB Atlas SRV lookups
    if (dbUri.startsWith('mongodb+srv://')) {
        try {
            dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
        } catch (e) {
            // Ignore if DNS server override is restricted
        }
    }

    console.log(`🔌 Connecting to MongoDB Atlas Cloud Database...`);

    try {
        const conn = await mongoose.connect(dbUri, {
            maxPoolSize: 20,
            minPoolSize: 2,
            maxIdleTimeMS: 30000,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000
        });

        console.log(`✅ MongoDB Connected: ${conn.connection.host} (Database: ${conn.connection.name})`);
        return conn;
    } catch (error) {
        console.error(`❌ MongoDB Atlas Connection Error: ${error.message}`);
        throw error;
    }
};

module.exports = connectDB;