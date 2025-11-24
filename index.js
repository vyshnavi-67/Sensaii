const express = require("express");
const { Client } = require("pg");
require("dotenv").config();

const app = express();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

client.connect()
  .then(() => console.log("Connected to Neon DB!"))
  .catch(err => console.error("DB error:", err));

app.get("/", async (req, res) => {
  const result = await client.query("SELECT NOW()");
  res.send(result.rows);
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});