const express = require("express");
const cors = require("cors");
require("dotenv").config();

const routes = require("./routes");
const { notFoundHandler, errorHandler } = require("./middleware/error.middleware");

const app = express();

// Middleware
app.use(cors({ origin: process.env.CLIENT_ORIGIN }));
app.use(express.json()); // parse JSON bodies

// Health check
app.get("/api/health", (req, res) => res.json({ ok: true }));

// Routes
app.use("/api", routes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;