import express, { Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import sql from "mssql";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// SQL Config
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  port: parseInt(process.env.DB_PORT || "1433", 10),
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

// MCP Server Definition
const server = new McpServer({
  name: "mssql-mcp-server",
  description: "MCP server for executing SQL queries",
  version: "1.0.0",
  tools: [
    {
      name: "execute-sql-query",
      description: "Execute a SQL query on the MS SQL database",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
        },
        required: ["query"],
      },
    },
  ],
});

// Tool Implementation
server.tool("execute-sql-query", "Execute a SQL query", async ({ query }) => {
  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request().query(query);
    return {
      content: [
        {
          type: "json",
          json: result.recordset,
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${err.message}`,
        },
      ],
    };
  }
});

// SSE Transport Registry
const transports: { [sessionId: string]: SSEServerTransport } = {};

// SSE Endpoint
app.get("/sse", async (req: Request, res: Response) => {
  const host = req.get("host");
  const fullUri = `https://${host}/sql`;
  const transport = new SSEServerTransport(fullUri, res);

  transports[transport.sessionId] = transport;

  res.on("close", () => {
    delete transports[transport.sessionId];
  });

  await server.connect(transport);
});

// POST Endpoint for tool execution
app.post("/sql", async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports[sessionId];
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).send("No transport found for sessionId");
  }
});

// Health Check
app.get("/", (_req, res) => {
  res.send("✅ MSSQL MCP Server is running!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server is running at http://localhost:${PORT}`);
});
