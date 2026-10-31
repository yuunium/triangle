import {
  evaluatePolygon,
  formatScore,
  SCORING_VERSION,
} from "../src/geometry.mjs";

const COOKIE = "sankaku_player";
const ROUND_TTL = 30 * 60 * 1000;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const json = (data, status = 200, headers = {}) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      Vary: "Cookie",
      ...headers,
    },
  });
function playerId(request) {
  const value = request.headers
    .get("Cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  return value && UUID.test(value) ? value : null;
}
function playerCookie(request, id) {
  return `${COOKIE}=${id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
export function validateSubmission(input) {
  if (
    !input ||
    !UUID.test(input.roundId || "") ||
    input.scoringVersion !== SCORING_VERSION
  )
    throw new ApiError(
      400,
      "この回の情報が無効です。もう一度つくってください。",
    );
  if (typeof input.name !== "string" || /[\p{Cc}\p{Cf}<>]/u.test(input.name))
    throw new ApiError(400, "名前は1〜16文字で入力してください。");
  const name = input.name.normalize("NFC").trim().replace(/\s+/gu, " ");
  if (!name || Array.from(name).length > 16)
    throw new ApiError(400, "名前は1〜16文字で入力してください。");
  if (
    !Array.isArray(input.points) ||
    input.points.length !== 7 ||
    input.points.some(
      (p) =>
        !p ||
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y) ||
        Math.abs(p.x) > 1e6 ||
        Math.abs(p.y) > 1e6,
    )
  )
    throw new ApiError(400, "七角形の座標が無効です。");
  const points = input.points.map(({ x, y }) => ({ x, y }));
  const result = evaluatePolygon(points);
  if (result.degenerate || result.selfIntersecting)
    throw new ApiError(400, "辺が交差した形や一直線の形は登録できません。");
  // Rank the displayed percentage, so identical visible scores share a rank.
  return {
    name,
    points,
    score: Number(formatScore(result.score)),
    scoreRaw: result.score,
    roundId: input.roundId,
  };
}
async function bodyJson(request) {
  if (
    !request.headers
      .get("Content-Type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    throw new ApiError(415, "JSON形式で送信してください。");
  const reader = request.body?.getReader();
  let size = 0,
    chunks = [];
  if (!reader) throw new ApiError(400, "送信内容が空です。");
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 4096) {
      await reader.cancel();
      throw new ApiError(413, "送信内容が大きすぎます。");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new ApiError(400, "送信内容を読み取れませんでした。");
  }
}
const rankedSql = `SELECT player_id, name, score, score_raw, achieved_at,
  RANK() OVER (ORDER BY score DESC) AS rank FROM records WHERE scoring_version = ?`;
async function leaderboard(db, id) {
  const entries = await db
    .prepare(
      `SELECT * FROM (${rankedSql}) ORDER BY score DESC, achieved_at ASC, player_id ASC LIMIT 50`,
    )
    .bind(SCORING_VERSION)
    .all();
  const own = id
    ? await db
        .prepare(`SELECT * FROM (${rankedSql}) WHERE player_id = ?`)
        .bind(SCORING_VERSION, id)
        .first()
    : null;
  const publicRow = (r) => ({
    name: r.name,
    score: r.score,
    scoreDisplay: formatScore(r.score_raw ?? r.score, 5),
    rank: r.rank,
    date: new Date(r.achieved_at).toISOString(),
    mine: r.player_id === id,
  });
  return {
    entries: entries.results.map(publicRow),
    own: own ? publicRow(own) : null,
  };
}
export async function handleApi(request, env) {
  const url = new URL(request.url),
    path = url.pathname;
  const isRead = path === "/api/leaderboard" && request.method === "GET";
  const isRound = path === "/api/rounds" && request.method === "POST";
  const isSubmit = path === "/api/scores" && request.method === "POST";
  if (!isRead && !isRound && !isSubmit)
    return json({ error: "見つかりません。" }, 404);
  try {
    if (
      request.headers.get("Sec-Fetch-Site") === "cross-site" ||
      (!isRead && request.headers.get("Origin") !== url.origin)
    )
      throw new ApiError(403, "ゲームの画面から送信してください。");
    if (!env.DB) throw new ApiError(503, "ランキングを準備中です。");
    const id = playerId(request);
    const limiter = isRead ? env.READ_LIMITER : env.WRITE_LIMITER;
    // A generous IP cap also limits clients that repeatedly discard their cookie.
    const ip = request.headers.get("CF-Connecting-IP") || "local";
    const allowed = limiter && (await limiter.limit({ key: ip })).success;
    if (!allowed)
      throw new ApiError(429, "少し時間をおいて、もう一度お試しください。");
    if (isRead) return json(await leaderboard(env.DB, id));
    const body = await bodyJson(request),
      now = Date.now();
    if (isRound) {
      if (body?.sides !== 7)
        throw new ApiError(400, "ランキングは七角形が対象です。");
      const player = id || crypto.randomUUID(),
        roundId = crypto.randomUUID();
      await env.DB.batch([
        env.DB.prepare("DELETE FROM rounds WHERE created_at < ?").bind(
          now - ROUND_TTL,
        ),
        env.DB.prepare(
          "INSERT INTO rounds(id, player_id, created_at) VALUES(?,?,?)",
        ).bind(roundId, player, now),
      ]);
      return json(
        { roundId, expiresAt: now + ROUND_TTL },
        201,
        id ? {} : { "Set-Cookie": playerCookie(request, player) },
      );
    }
    if (!id)
      throw new ApiError(
        401,
        "この回を確認できません。もう一度つくってください。",
      );
    const input = validateSubmission(body);
    const round = await env.DB.prepare(
      "SELECT * FROM rounds WHERE id = ? AND player_id = ?",
    )
      .bind(input.roundId, id)
      .first();
    if (!round || round.created_at < now - ROUND_TTL)
      throw new ApiError(
        410,
        "この回の有効期限が切れました。もう一度つくってください。",
      );
    if (round.consumed_at !== null) {
      if (
        round.name !== input.name ||
        round.points_json !== JSON.stringify(input.points)
      )
        throw new ApiError(409, "この回は登録済みです。");
      return json({
        ...(await leaderboard(env.DB, id)),
        submittedScore: round.score,
      });
    }
    // D1 batches are atomic. A consumed round supplies all values for the upsert;
    // concurrent or retried submissions cannot change its finalized score/name.
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE rounds SET consumed_at=?, name=?, score=?, score_raw=?, points_json=? WHERE id=? AND player_id=? AND consumed_at IS NULL",
      ).bind(
        now,
        input.name,
        input.score,
        input.scoreRaw,
        JSON.stringify(input.points),
        input.roundId,
        id,
      ),
      env.DB.prepare(
        `INSERT INTO records(player_id,name,score,score_raw,achieved_at,round_id,points_json,scoring_version)
        SELECT player_id,name,score,score_raw,consumed_at,id,points_json,? FROM rounds WHERE id=? AND player_id=? AND consumed_at IS NOT NULL
        ON CONFLICT(player_id) DO UPDATE SET name=excluded.name,score=excluded.score,score_raw=excluded.score_raw,achieved_at=excluded.achieved_at,round_id=excluded.round_id,points_json=excluded.points_json,scoring_version=excluded.scoring_version
        WHERE excluded.score > records.score OR excluded.scoring_version != records.scoring_version`,
      ).bind(SCORING_VERSION, input.roundId, id),
    ]);
    const saved = await env.DB.prepare(
      "SELECT score FROM rounds WHERE id=? AND player_id=?",
    )
      .bind(input.roundId, id)
      .first();
    return json(
      { ...(await leaderboard(env.DB, id)), submittedScore: saved.score },
      201,
    );
  } catch (error) {
    if (error instanceof ApiError)
      return json({ error: error.message }, error.status);
    console.error("Ranking API failed", error.message);
    return json(
      {
        error:
          "ランキングに接続できませんでした。少し時間をおいてお試しください。",
      },
      503,
    );
  }
}
export default {
  fetch(request, env) {
    return new URL(request.url).pathname.startsWith("/api/")
      ? handleApi(request, env)
      : env.ASSETS.fetch(request);
  },
};
