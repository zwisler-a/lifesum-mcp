import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import 'dotenv/config';
import { fetchWeekExportCsv, tokenStatus } from './lifesumClient.js';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

async function main() {
  const date = process.argv[2] || todayIso();
  const token = process.env.LIFESUM_TOKEN;

  if (!token) {
    console.error('Missing LIFESUM_TOKEN env var. See .env.example.');
    process.exit(1);
  }

  const status = tokenStatus(token);
  console.error(
    `Token expires ${status.expiresAt.toISOString()} (${Math.round(status.secondsRemaining / 3600)}h remaining)`
  );

  const csv = await fetchWeekExportCsv(date, token);

  const outDir = path.resolve('data');
  await mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, `export-${date}.csv`);
  await writeFile(outFile, csv, 'utf8');

  console.error(`Saved ${outFile}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
