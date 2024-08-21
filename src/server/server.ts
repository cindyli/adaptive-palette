/**
 * Copyright (c) 2024, Inclusive Design Institute
 *
 * Licensed under the BSD 3-Clause License. You may not use this file except
 * in compliance with this License.
 *
 * You may obtain a copy of the BSD 3-Clause License at
 * https://github.com/inclusive-design/baby-bliss-bot/blob/main/LICENSE
 */

import express, { Express } from "express";
import path from "path";
import { fileURLToPath } from "url";
import serveStatic from "serve-static";
import { config } from "../../config/config.js";

const PORT: number = config.server.port;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();

// Parse incoming requests with JSON payloads
app.use(express.json());

// Serve static files from the root dist directory
app.use(serveStatic(path.join(__dirname, "../../../client")));

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy"
  });
});
