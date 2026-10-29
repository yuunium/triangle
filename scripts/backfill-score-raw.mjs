import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { evaluatePolygon, SCORING_VERSION } from "../src/geometry.mjs";

const location = process.argv.includes("--remote") ? "--remote" : "--local";
const cli = "node_modules/wrangler/bin/wrangler.js";
function query(args, readResults = true) {
  const result = spawnSync(
    process.execPath,
    [cli, "d1", "execute", "sankaku-ranking", location, "--json", ...args],
    { encoding: "utf8" },
  );
  if (result.status !== 0)
    throw new Error(result.stderr || "D1 command failed");
  // Remote file execution prints upload progress before its JSON output.
  // Only SELECT commands need parsed results; writes are checked by exit status.
  if (!readResults) return [];
  const parsed = JSON.parse(result.stdout);
  if (parsed.some((item) => item.success === false))
    throw new Error("D1 command failed");
  return parsed.flatMap((item) => item.results || []);
}
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const statements = [];
for (const [table, key] of [
  ["records", "player_id"],
  ["rounds", "id"],
]) {
  const rows = query([
    "--command",
    `SELECT ${key} AS id,points_json FROM ${table} WHERE score_raw IS NULL AND points_json IS NOT NULL${table === "records" ? ` AND scoring_version=${quote(SCORING_VERSION)}` : ""}`,
  ]);
  for (const row of rows) {
    const result = evaluatePolygon(JSON.parse(row.points_json));
    if (result.degenerate || result.selfIntersecting)
      throw new Error(`Invalid stored geometry in ${table}; backfill stopped`);
    statements.push(
      `UPDATE ${table} SET score_raw=${result.score} WHERE ${key}=${quote(row.id)} AND score_raw IS NULL AND points_json=${quote(row.points_json)};`,
    );
  }
}
if (statements.length) {
  await mkdir(".wrangler", { recursive: true });
  const path = ".wrangler/backfill-score-raw.sql";
  await writeFile(path, statements.join("\n"));
  query(["--file", path], false);
}
console.log(
  `Precise score backfill complete (${location}): ${statements.length} existing rows processed.`,
);
