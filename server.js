require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const sql = require('mssql');

const app = express();
app.use(bodyParser.json());

// SQL Config
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  port: parseInt(process.env.DB_PORT, 10),
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
};

// MCP Metadata
const MCP_METADATA = {
  name: "mssql-mcp-server",
  version: "1.0.0",
  tools: [
    {
      name: "executeQuery",
      description: "Execute a SQL query on the MS SQL database",
      input_schema: {
        type: "object",
        properties: {
          query: { type: "string" }
        },
        required: ["query"]
      }
    }
  ]
};

// MCP Discovery Endpoint
app.get('/resources', (req, res) => {
  res.json(MCP_METADATA);
});

// MCP Tool Execution Endpoint
app.post('/tools/executeQuery', async (req, res) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: "Missing query parameter" });
  }

  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request().query(query);
    res.json({ rows: result.recordset });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// SSE Endpoint for MCP compatibility
app.get('/sse', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sessionId = req.query.sessionId || 'default-session';
  res.write(`data: ${JSON.stringify({ sessionId, message: 'SSE connection established' })}\n\n`);

  const interval = setInterval(() => {
    res.write(`data: ${JSON.stringify({ sessionId, ping: new Date().toISOString() })}\n\n`);
  }, 15000);

  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MCP server running on port ${PORT}`);
});
