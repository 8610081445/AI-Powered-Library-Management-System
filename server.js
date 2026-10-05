const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const db = require("./config/db");
const bookRoutes = require("./routes/bookRoutes");
const memberRoutes = require("./routes/memberRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const aiRoutes = require("./routes/aiRoutes");
const authRoutes = require("./routes/authRoutes");
const { seedDatabase } = require("./scripts/seedData");

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend
app.use(express.static(path.join(__dirname, "public")));

// API Health Check
app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        app: "AI-Powered Library Management System",
        timestamp: new Date().toISOString(),
        database: db.getEngine()
    });
});

// Mount Routes
app.use("/api/auth", authRoutes);
app.use("/api/books", bookRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/ai", aiRoutes);

// Catch-all middleware to serve Single Page Application
app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) {
        return res.status(404).json({ success: false, message: "Endpoint not found" });
    }
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Central Error Handler
app.use((err, req, res, next) => {
    console.error("[Unhandled Error]", err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || "Internal Server Error"
    });
});

// Start Server & Auto-Check DB
let serverInstance = null;
async function startServer() {
    if (serverInstance) return serverInstance;
    try {
        await db.initDB();
        await seedDatabase();

        return new Promise((resolve) => {
            serverInstance = app.listen(PORT, "0.0.0.0", () => {
                console.log("==================================================");
                console.log(`🚀 AthenaLib - AI Library System is running!`);
                console.log(`🌐 Dashboard:    http://localhost:${PORT}`);
                console.log(`🌐 Local Link:   http://127.0.0.1:${PORT}`);
                console.log(`📡 API Health:   http://localhost:${PORT}/api/health`);
                console.log(`💾 DB Engine:    ${db.getEngine().engine.toUpperCase()}`);
                console.log("==================================================");
                console.log(`👉 Click the link above to open in your browser`);
                resolve(serverInstance);
            });
        });
    } catch (err) {
        console.error("Failed to start server:", err);
        process.exit(1);
    }
}

// Auto-start if run directly or as main script
startServer();

module.exports = { app, startServer };
