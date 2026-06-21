#!/usr/bin/env node
/**
 * Study Platform - Self-contained Server
 * Requires: Node.js 18+
 * Run: node server.js
 * Open: http://localhost:3000
 */

const http  = require("http");
const https = require("https");
const fs    = require("fs");
const path  = require("path");
const url   = require("url");

// ── Config ────────────────────────────────────────────────────────────────────
const PORT      = process.env.PORT || 3000;
const PUBLIC    = path.join(__dirname, "public");

// Load .env from same directory
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split(/\r?\n/).forEach(line => {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  });
}

const CEREBRAS_KEY = process.env.CEREBRAS_API_KEY || "";
const OPENAI_KEY   = process.env.OPENAI_API_KEY   || "";

// ── MIME types ────────────────────────────────────────────────────────────────
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript",
  ".css":  "text/css",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".webp": "image/webp",
  ".ico":  "image/x-icon",
  ".woff2":"font/woff2",
  ".json": "application/json",
  ".txt":  "text/plain",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function send(res, code, type, body) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
  res.writeHead(code, {
    "Content-Type":  type,
    "Content-Length": buf.length,
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-cache",
  });
  res.end(buf);
}

function sendJSON(res, code, data) {
  send(res, code, "application/json", JSON.stringify(data));
}

function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(body);
    const req  = https.request({ hostname, path, method: "POST",
      headers: { ...headers, "Content-Length": data.length } }, res => {
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

// ── AI handler ────────────────────────────────────────────────────────────────
async function handleAI(req, res) {
  const apiKey    = CEREBRAS_KEY || OPENAI_KEY;
  const isCerebras = !!CEREBRAS_KEY;

  if (!apiKey) {
    return sendJSON(res, 503, { error: "AI not configured — add CEREBRAS_API_KEY to .env" });
  }

  let body = "";
  for await (const chunk of req) body += chunk;

  let parsed;
  try { parsed = JSON.parse(body); } catch {
    return sendJSON(res, 400, { error: "Invalid JSON" });
  }

  const { messages = [], systemPrompt = "أنت مساعد دراسي مفيد باللغة العربية." } = parsed;

  const hostname = isCerebras ? "api.cerebras.ai" : "api.openai.com";
  const model    = isCerebras ? "gpt-oss-120b" : "gpt-4o-mini";

  const payload = JSON.stringify({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages.slice(-20),
    ],
    max_tokens: 800,
    temperature: 0.7,
  });

  try {
    const result = await httpsPost(hostname, "/v1/chat/completions", {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${apiKey}`,
    }, payload);

    if (result.status !== 200) {
      console.error("[AI] upstream error", result.status, result.body);
      return sendJSON(res, 502, { error: "AI upstream error", detail: result.body });
    }

    const data  = JSON.parse(result.body);
    const reply = data.choices?.[0]?.message?.content || "عذراً، لم أفهم سؤالك.";
    sendJSON(res, 200, { reply });
  } catch (e) {
    console.error("[AI] error:", e.message);
    sendJSON(res, 500, { error: e.message });
  }
}

// ── Static file handler ───────────────────────────────────────────────────────
function serveStatic(req, res, pathname) {
  // Strip query string
  pathname = pathname.split("?")[0];
  let filePath = path.join(PUBLIC, pathname);

  // Prevent path traversal
  if (!filePath.startsWith(PUBLIC)) {
    return send(res, 403, "text/plain", "Forbidden");
  }

  // Directory → index.html
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  if (!fs.existsSync(filePath)) {
    // SPA fallback
    filePath = path.join(PUBLIC, "index.html");
  }

  const ext  = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || "application/octet-stream";
  send(res, 200, mime, fs.readFileSync(filePath));
}

// ── Server ────────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const { pathname } = url.parse(req.url);

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  // API: AI chat
  if (req.method === "POST" && pathname === "/api/ai/chat") {
    return handleAI(req, res);
  }

  // Static files
  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log("=".repeat(48));
  console.log("  Study Platform");
  console.log("=".repeat(48));
  console.log(`  URL  : http://localhost:${PORT}`);
  console.log(`  AI   : ${CEREBRAS_KEY ? "✓ Cerebras (gpt-oss-120b)" : OPENAI_KEY ? "✓ OpenAI (gpt-4o-mini)" : "✗ disabled (add key to .env)"}`);
  console.log("  Stop : Ctrl+C");
  console.log("=".repeat(48));
});
