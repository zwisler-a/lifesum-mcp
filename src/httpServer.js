import 'dotenv/config';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from './mcpServer.js';

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN;

function methodNotAllowed(res) {
  res.writeHead(405, { 'Content-Type': 'application/json' }).end(
    JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed.' },
      id: null,
    })
  );
}

function checkAuth(req, res) {
  if (!AUTH_TOKEN) return true;
  const header = req.headers.authorization || '';
  const [scheme, value] = header.split(' ');
  if (scheme === 'Bearer' && value === AUTH_TOKEN) return true;
  res.writeHead(401, { 'Content-Type': 'application/json' }).end(
    JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32001, message: 'Unauthorized' },
      id: null,
    })
  );
  return false;
}

const app = createMcpExpressApp({ host: HOST, allowedHosts: process.env.MCP_ALLOWED_HOSTS?.split(',') });

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/mcp', async (req, res) => {
  if (!checkAuth(req, res)) return;

  const server = createServer();
  try {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on('close', () => {
      transport.close();
      server.close();
    });
  } catch (err) {
    console.error('Error handling MCP request:', err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
});

app.get('/mcp', (req, res) => methodNotAllowed(res));
app.delete('/mcp', (req, res) => methodNotAllowed(res));

app.listen(PORT, HOST, () => {
  console.log(`lifesum-sync MCP server (streamable-http) listening on http://${HOST}:${PORT}/mcp`);
});
