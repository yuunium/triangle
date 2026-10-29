import { useEffect, useRef, useState } from "react";
import { formatScore, SCORING_VERSION } from "./geometry.mjs";
import { rankingRequest } from "./ranking-api.mjs";

export function Leaderboard({ refreshKey }) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setError("");
    rankingRequest("leaderboard")
      .then((value) => {
        if (!cancelled) setData(value);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey, retry]);
  return (
    <section className="leaderboard" aria-labelledby="ranking-title">
      <div className="ranking-heading">
        <div>
          <p className="ranking-eyebrow">LEADERBOARD / 7 POINTS</p>
          <h2 id="ranking-title">七角形ランキング</h2>
        </div>
        <button
          className="text-button ranking-refresh"
          onClick={() => setRetry((v) => v + 1)}
        >
          更新する
        </button>
      </div>
      <p className="ranking-description">
        みんなの目測、どこまでぴったり？ 上位50件の自己ベスト。
      </p>
      {error ? (
        <p role="status" className="ranking-status">
          {error}
        </p>
      ) : !data ? (
        <p role="status" className="ranking-status">
          記録を読み込み中…
        </p>
      ) : (
        <>
          {data.own && (
            <p className="personal-best">
              あなたの自己ベスト{" "}
              <strong>
                {formatScore(data.own.score)}
                <small>%</small>
              </strong>
              <span>{data.own.rank}位</span>
            </p>
          )}
          {data.entries.length === 0 ? (
            <p className="ranking-empty">
              まだ記録がありません。最初の七角形を残そう。
            </p>
          ) : (
            <table className="ranking-table">
              <caption className="sr-only">
                七角形の自己ベスト上位50件。同じ一致度は同順位です。
              </caption>
              <thead>
                <tr>
                  <th scope="col">順位</th>
                  <th scope="col">名前</th>
                  <th scope="col">一致度</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((entry, index) => (
                  <tr
                    key={`${entry.rank}-${index}`}
                    className={entry.mine ? "ranking-row--mine" : ""}
                  >
                    <td>{entry.rank.toString().padStart(2, "0")}</td>
                    <th scope="row">
                      {entry.name}
                      {entry.mine && (
                        <span className="ranking-you">あなた</span>
                      )}
                    </th>
                    <td>
                      {formatScore(entry.score)}
                      <small>%</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="ranking-footnote">
            同じ一致度は同順位。同じブラウザーの自己ベストを1件記録します。Cookieを消すと、自分の記録として確認できなくなります。
          </p>
        </>
      )}
    </section>
  );
}

export function RankingSubmission({
  points,
  result,
  round,
  roundStatus,
  onSaved,
}) {
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem("sankaku-name") || "";
    } catch {
      return "";
    }
  });
  const [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(null),
    [error, setError] = useState("");
  const pending = useRef(false),
    active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const valid = !result.degenerate && !result.selfIntersecting;
  async function submit(event) {
    event.preventDefault();
    if (pending.current || saved || !round || !valid) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const data = await rankingRequest("scores", {
        roundId: round.roundId,
        name,
        points,
        scoringVersion: SCORING_VERSION,
      });
      try {
        localStorage.setItem("sankaku-name", name.trim());
      } catch {
        /* Storage may be unavailable. */
      }
      if (active.current) {
        setSaved(data);
        onSaved();
      }
    } catch (err) {
      if (active.current) setError(err.message);
    } finally {
      pending.current = false;
      if (active.current) setBusy(false);
    }
  }
  return (
    <section
      className="ranking-submission"
      aria-labelledby="save-ranking-title"
    >
      <h2 id="save-ranking-title">ランキングに残す</h2>
      {!valid ? (
        <p className="ranking-status">
          辺が交差した形や一直線の形は登録できません。もう一度挑戦してみよう。
        </p>
      ) : saved ? (
        <p className="ranking-saved" role="status">
          記録しました。あなたの自己ベストは{" "}
          <strong>{formatScore(saved.own.score)}%</strong>、{saved.own.rank}
          位です。
        </p>
      ) : (
        <form onSubmit={submit}>
          <label htmlFor="ranking-name" className="sr-only">
            ニックネーム
          </label>
          <div className="ranking-form-row">
            <input
              id="ranking-name"
              name="nickname"
              autoComplete="nickname"
              placeholder="ニックネーム"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={32}
              disabled={busy}
              aria-describedby="ranking-consent"
            />
            <button
              className="share-button"
              type="submit"
              aria-label="ランキングに登録"
              disabled={busy || !round || !name.trim()}
            >
              {busy ? "登録中…" : "ランキング登録"}
            </button>
          </div>
          <p id="ranking-consent" className="ranking-footnote">
            1〜16文字。名前・一致度が公開されます。
          </p>
          {!round && (
            <p className="ranking-status" role="status">
              {roundStatus || "ランキングの準備中…"}
            </p>
          )}
          {round && Date.now() > round.expiresAt && (
            <p className="ranking-status">
              この回は30分を過ぎています。登録できない場合はもう一度つくってください。
            </p>
          )}
          {error && (
            <p role="alert" className="ranking-error">
              {error}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
