import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { handleApi, validateSubmission } from "../cloudflare/index.mjs";
import {
  SCORING_VERSION,
  evaluatePolygon,
  formatScore,
} from "../src/geometry.mjs";

const regular = (n) =>
  Array.from({ length: n }, (_, i) => ({
    x: 500 + 120 * Math.cos((i * 2 * Math.PI) / n),
    y: 230 + 120 * Math.sin((i * 2 * Math.PI) / n),
  }));
const sample = {
  roundId: crypto.randomUUID(),
  name: "プレイヤー",
  scoringVersion: SCORING_VERSION,
  points: regular(7),
  score: 1,
};
function setup() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(
    readFileSync(
      new URL("../cloudflare/migrations/0001_ranking.sql", import.meta.url),
      "utf8",
    ),
  );
  const db = {
    prepare(sql) {
      const bound = (args) => ({
        bind: (...next) => bound(next),
        all: async () => ({ results: sqlite.prepare(sql).all(...args) }),
        first: async () => sqlite.prepare(sql).get(...args) || null,
      });
      return bound([]);
    },
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.all());
        sqlite.exec("COMMIT");
        return results;
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    },
  };
  const env = {
    DB: db,
    READ_LIMITER: { limit: async () => ({ success: true }) },
    WRITE_LIMITER: { limit: async () => ({ success: true }) },
  };
  const client = () => {
    let cookie = "";
    return async (path, body, headers = {}) => {
      const request = new Request(`https://game.example/api/${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          Origin: "https://game.example",
          "Content-Type": "application/json",
          Cookie: cookie,
          ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const response = await handleApi(request, env);
      if (response.headers.has("Set-Cookie"))
        cookie = response.headers.get("Set-Cookie").split(";")[0];
      return { response, data: await response.json() };
    };
  };
  return { sqlite, env, client };
}
test("submission recomputes the score, normalizes names and rejects unsupported or unsafe data", () => {
  assert.equal(
    validateSubmission({ ...sample, name: "  なまえ  ", score: 1 }).score,
    100,
  );
  assert.equal(
    validateSubmission({ ...sample, name: "  なまえ  " }).name,
    "なまえ",
  );
  for (const change of [
    { points: regular(8) },
    { points: regular(6) },
    { points: regular(7).map((p) => ({ ...p, x: Infinity })) },
    { name: "<script>" },
    { name: "a".repeat(17) },
    { name: "\u202Eabc" },
    { name: " " },
    { scoringVersion: "old" },
    { roundId: "fake" },
  ])
    assert.throws(() => validateSubmission({ ...sample, ...change }));
});
test("rankings store one best per browser, consume rounds and expose no player credentials", async () => {
  const { sqlite, client } = setup();
  const a = client(),
    b = client();
  try {
    assert.equal((await a("leaderboard")).data.entries.length, 0);
    const round = await a("rounds", { sides: 7 });
    assert.equal(round.response.status, 201);
    assert.match(
      round.response.headers.get("Set-Cookie"),
      /HttpOnly; SameSite=Strict/,
    );
    const payload = { ...sample, roundId: round.data.roundId };
    const saved = await a("scores", payload);
    assert.equal(saved.data.own.score, 100);
    assert.equal(saved.data.own.rank, 1);
    assert.equal(saved.data.entries.length, 1);
    assert.equal(saved.data.entries[0].player_id, undefined);
    assert.equal(saved.data.entries[0].round_id, undefined);
    assert.equal((await a("scores", payload)).response.status, 200);
    assert.equal(
      (await a("scores", { ...payload, name: "変更" })).response.status,
      409,
    );
    assert.equal((await b("scores", payload)).response.status, 401);
    const next = await a("rounds", { sides: 7 });
    const worse = regular(7);
    worse[0].x += 40;
    const lower = await a("scores", {
      ...payload,
      roundId: next.data.roundId,
      points: worse,
      score: 100,
    });
    assert.equal(
      lower.data.submittedScore,
      Number(formatScore(evaluatePolygon(worse).score)),
    );
    assert.ok(lower.data.submittedScore < 100);
    assert.equal(lower.data.own.score, 100);
    assert.equal(lower.data.entries.length, 1);
    const second = await b("rounds", { sides: 7 });
    const tie = await b("scores", {
      ...sample,
      name: "もうひとり",
      roundId: second.data.roundId,
    });
    assert.deepEqual(
      tie.data.entries.map((r) => r.rank),
      [1, 1],
    );
    assert.equal(tie.data.entries.filter((r) => r.mine).length, 1);
  } finally {
    sqlite.close();
  }
});
test("origin, body size, rate limits, ownership and expired rounds are enforced", async () => {
  const { sqlite, client, env } = setup();
  const a = client(),
    b = client();
  try {
    assert.equal(
      (await a("rounds", { sides: 7 }, { Origin: "https://evil.example" }))
        .response.status,
      403,
    );
    assert.equal(
      (await a("rounds", { sides: 7 }, { "Content-Type": "text/plain" }))
        .response.status,
      415,
    );
    assert.equal((await a("rounds", { sides: 8 })).response.status, 400);
    assert.equal(
      (await a("rounds", { sides: 7, pad: "x".repeat(4096) })).response.status,
      413,
    );
    const round = await a("rounds", { sides: 7 });
    await b("rounds", { sides: 7 });
    assert.equal(
      (await b("scores", { ...sample, roundId: round.data.roundId })).response
        .status,
      410,
    );
    sqlite
      .prepare("UPDATE rounds SET created_at=0 WHERE id=?")
      .run(round.data.roundId);
    assert.equal(
      (await a("scores", { ...sample, roundId: round.data.roundId })).response
        .status,
      410,
    );
    env.WRITE_LIMITER.limit = async () => ({ success: false });
    assert.equal((await a("rounds", { sides: 7 })).response.status, 429);
    assert.equal((await a("unknown")).response.status, 404);
  } finally {
    sqlite.close();
  }
});
