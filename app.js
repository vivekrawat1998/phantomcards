require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const multer = require("multer");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());
const Buffer = require("buffer").Buffer;

const decodeBase64 = (encoded) =>
  Buffer.from(encoded, "base64").toString("utf-8");

// Create connection pool with proper error handling
const pool = mysql.createPool({
  host: decodeBase64(process.env.DB_HOST),
  user: decodeBase64(process.env.DB_USER),
  password: decodeBase64(process.env.DB_PASSWORD),
  database: decodeBase64(process.env.DB_NAME),
  ssl: {
    rejectUnauthorized: true
  },
  waitForConnections: true,
  connectionLimit: 1, // Reduce for serverless
  maxIdle: 1, // Reduce idle connections
  enableKeepAlive: false, // Disable connection keepalive
  idleTimeout: 60000 // Reduce idle timeout
});

// Convert pool to promise-based operations
const promisePool = pool.promise();

// Health check endpoint
app.get("/api/healthcheck", async (req, res) => {
  try {
    await promisePool.query("SELECT 1");
    res.status(200).json({ status: "healthy" });
  } catch (error) {
    console.error("Health check failed:", error);
    res.status(500).json({ status: "unhealthy", error: error.message });
  }
});

// Setup multer
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Form submission endpoint with async/await
app.post("/api/submit-form", async (req, res) => {
  try {
    const { name, phonenumber, address, city, state, pincode } = req.body;

    if (!name || !phonenumber || !address || !city || !state || !pincode) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const [results] = await promisePool.execute(
      "INSERT INTO formdata_with_image (name, phonenumber, address, city, pincode, state, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())",
      [name, phonenumber, address, city, pincode, state]
    );

    res.status(201).json({ 
      message: "Form submitted successfully", 
      id: results.insertId 
    });
  } catch (error) {
    console.error("Error in submit-form:", error);
    res.status(500).json({ 
      error: "Database operation failed", 
      details: error.message 
    });
  }
});

// Image upload endpoint with async/await
app.post("/api/upload-image/:formId", upload.single("image"), async (req, res) => {
  try {
    const { formId } = req.params;
    const image = req.file;

    if (!image) {
      return res.status(400).json({ error: "Image file is required" });
    }

    // Check if form exists
    const [form] = await promisePool.execute(
      "SELECT id FROM formdata_with_image WHERE id = ?",
      [formId]
    );

    if (form.length === 0) {
      return res.status(404).json({ error: "Form ID not found" });
    }

    // Update image
    const [result] = await promisePool.execute(
      "UPDATE formdata_with_image SET image_data = ? WHERE id = ?",
      [image.buffer, formId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: "Image upload failed, form ID not found or image unchanged"
      });
    }

    res.status(200).json({ 
      message: "Image uploaded successfully", 
      id: formId 
    });
  } catch (error) {
    console.error("Error in upload-image:", error);
    res.status(500).json({ 
      error: "Database operation failed", 
      details: error.message 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: "Something broke!", 
    details: err.message 
  });
});

module.exports = app;
