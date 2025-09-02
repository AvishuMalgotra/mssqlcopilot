require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const sql = require('mssql');

const app = express();
app.use(bodyParser.json());

// SQL Config

const dbConfig = {
  user: "sqladmin",
  password: "Wind0wsazure@123",
  server: "sqltpt.database.windows.net",
  database: "NorthWinds Updated",
  port: 1433,
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MCP server running on port ${PORT}`);
});