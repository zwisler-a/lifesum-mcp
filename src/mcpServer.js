import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { fetchWeekExportCsv, tokenStatus } from './lifesumClient.js';
import { getToken, setToken, getTokenStatus } from './tokenStore.js';
import { parseNutritionCsv } from './csv.js';
import { summarizeByDay } from './summarize.js';

async function requireToken() {
  const token = await getToken();
  if (!token) {
    throw new Error(
      'No Lifesum token registered. Use the register_lifesum_token tool to set one.'
    );
  }
  const status = tokenStatus(token);
  if (status.isExpired) {
    throw new Error(
      `Lifesum token expired at ${status.expiresAt.toISOString()}. ` +
        'Log in to lifesum.com in a browser, copy the Authorization Bearer token for a ' +
        '/food-tracker/v1/export/week request from DevTools, and call register_lifesum_token again.'
    );
  }
  return token;
}

/** Builds a fresh, fully-configured McpServer instance (no transport attached). */
export function createServer() {
  const server = new McpServer({ name: 'lifesum-sync', version: '1.0.0' });

  server.registerTool(
    'get_nutrition_week',
    {
      title: 'Get Lifesum nutrition data for a week',
      description:
        'Fetches logged food entries for the 7-day window ending on the given date (defaults to today) ' +
        'from Lifesum, including per-entry macros and a per-day summary.',
      inputSchema: {
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe('End date of the 7-day window, YYYY-MM-DD. Defaults to today.'),
      },
    },
    async ({ date }) => {
      const token = await requireToken();
      const endDate = date || new Date().toISOString().slice(0, 10);
      const csv = await fetchWeekExportCsv(endDate, token);
      const entries = parseNutritionCsv(csv);
      const dailySummary = summarizeByDay(entries);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ endDate, dailySummary, entries }, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    'register_lifesum_token',
    {
      title: 'Register a Lifesum Bearer token',
      description:
        'Stores a Lifesum Bearer JWT for use by other tools, persisting it to disk. The token is lifted ' +
        'from a browser session (DevTools → Network → a request to api.lifesum.com/food-tracker/v1/export/week/...) ' +
        'and is valid for about 48 hours.',
      inputSchema: {
        token: z.string().min(1).describe('The raw Bearer token (JWT), without the "Bearer " prefix.'),
      },
    },
    async ({ token }) => {
      const status = await setToken(token);
      return {
        content: [
          {
            type: 'text',
            text:
              `Token registered. Issued ${status.issuedAt.toISOString()}, ` +
              `expires ${status.expiresAt.toISOString()} ` +
              `(${Math.round(status.secondsRemaining / 3600)}h remaining).`,
          },
        ],
      };
    }
  );

  server.registerTool(
    'lifesum_token_status',
    {
      title: 'Check the registered Lifesum token status',
      description: 'Reports whether a Lifesum token is registered, and its expiry status.',
      inputSchema: {},
    },
    async () => {
      const status = await getTokenStatus();
      if (!status) {
        return { content: [{ type: 'text', text: 'No Lifesum token is registered.' }] };
      }
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                issuedAt: status.issuedAt.toISOString(),
                expiresAt: status.expiresAt.toISOString(),
                isExpired: status.isExpired,
                secondsRemaining: status.secondsRemaining,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  return server;
}
