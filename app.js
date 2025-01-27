require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const multer = require("multer");
const path = require("path");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());
const Buffer = require("buffer").Buffer;

const decodeBase64 = (encoded) =>
  Buffer.from(encoded, "base64").toString("utf-8");

const connectionConfig = {
  host: decodeBase64(process.env.DB_HOST),
  user: decodeBase64(process.env.DB_USER),
  password: decodeBase64(process.env.DB_PASSWORD),
  database: decodeBase64(process.env.DB_NAME),
  ssl: process.env.VERCEL ? {
    rejectUnauthorized: true
  } : false,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const pool = mysql.createPool(connectionConfig);

pool.getConnection((err, connection) => {
  if (err) {
    console.error("Error connecting to the database:", err);
    process.exit(1);
  } else {
    console.log("Connected to the database");
    connection.release();
  }
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.post("/api/submit-form", (req, res) => {
  const { name, phonenumber, address, city, state, pincode } = req.body;

  if (!name || !phonenumber || !address || !city || !state || !pincode) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const sql =
    "INSERT INTO formdata_with_image (name, phonenumber, address, city, pincode, state, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())";

  pool.query(
    sql,
    [name, phonenumber, address, city, pincode, state],
    (err, results) => {
      if (err) {
        console.error("Error executing query:", err);
        return res.status(500).json({ error: "Database operation failed" });
      }

      console.log("Form data inserted successfully:", results);
      res
        .status(201)
        .json({ message: "Form submitted successfully", id: results.insertId });
    }
  );
});

app.post("/api/upload-image/:formId", upload.single("image"), (req, res) => {
  const formId = req.params.formId;
  const image = req.file;
  if (!image) {
    return res.status(400).json({ error: "Image file is required" });
  }

  const imageBuffer = image.buffer;

  const checkFormExistenceSQL =
    "SELECT id FROM formdata_with_image WHERE id = ?";
  pool.query(checkFormExistenceSQL, [formId], (err, results) => {
    if (err) {
      console.error("Error checking form existence:", err);
      return res.status(500).json({ error: "Database operation failed" });
    }

    if (results.length === 0) {
      console.log("No form found with the given formId");
      return res.status(404).json({ error: "Form ID not found" });
    }

    const updateImageSQL =
      "UPDATE formdata_with_image SET image_data = ? WHERE id = ?";
    pool.query(updateImageSQL, [imageBuffer, formId], (err, results) => {
      if (err) {
        console.error("Error executing query:", err);
        return res.status(500).json({ error: "Database operation failed" });
      }

      if (results.changedRows === 0) {
        console.log("No rows were updated");
        return res.status(404).json({
          error: "Image upload failed, form ID not found or image unchanged",
        });
      }

      console.log("Image uploaded successfully:", results);
      res
        .status(200)
        .json({ message: "Image uploaded successfully", id: formId });
    });
  });
});

module.exports = app;
