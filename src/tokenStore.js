import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tokenStatus } from './lifesumClient.js';

const STORE_DIR = path.resolve(process.env.DATA_DIR || 'data');
const STORE_FILE = path.join(STORE_DIR, 'token.json');

let cachedToken = null;
let loaded = false;

async function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await readFile(STORE_FILE, 'utf8');
    cachedToken = JSON.parse(raw).token || null;
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    cachedToken = process.env.LIFESUM_TOKEN || null;
  }
}

/** Returns the currently registered token, or null if none is set. */
export async function getToken() {
  await load();
  return cachedToken;
}

/** Validates and persists a new token, replacing any previously registered one. */
export async function setToken(token) {
  const status = tokenStatus(token); // throws if not a decodable JWT
  if (status.isExpired) {
    throw new Error(`Token is already expired (expired at ${status.expiresAt.toISOString()}).`);
  }

  await mkdir(STORE_DIR, { recursive: true });
  await writeFile(STORE_FILE, JSON.stringify({ token, registeredAt: new Date().toISOString() }, null, 2), 'utf8');
  cachedToken = token;
  loaded = true;
  return status;
}

/** Returns status for the currently registered token, or null if none is set. */
export async function getTokenStatus() {
  const token = await getToken();
  if (!token) return null;
  return tokenStatus(token);
}
