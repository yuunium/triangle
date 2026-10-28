import { useEffect, useRef, useState } from "react";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react/dist/csr/ArrowCounterClockwise";
import { ArrowUUpLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowUUpLeft";
import { HandPointingIcon } from "@phosphor-icons/react/dist/csr/HandPointing";
import { TriangleIcon } from "@phosphor-icons/react/dist/csr/Triangle";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { ShareResult } from "./ShareResult.jsx";
import {
  evaluatePolygon,
  fitRegularPolygon,
  formatScore,
  scoreMessage,
  POLYGON_NAMES,
  SIDE_COUNTS,
} from "./geometry.mjs";

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const WIDTH = 1000,
  HEIGHT = 460,
  MARGIN = 36;
function getView(rect, points) {
  let scale = Math.min(rect.width / WIDTH, rect.height / HEIGHT);
  for (const p of points) {
    scale = Math.min(
      scale,
      (rect.width / 2 - MARGIN) / Math.max(1, Math.abs(p.x - WIDTH / 2)),
      (rect.height / 2 - MARGIN) / Math.max(1, Math.abs(p.y - HEIGHT / 2)),
    );
  }
  return {
    scale,
    x: (rect.width - WIDTH * scale) / 2,
    y: (rect.height - HEIGHT * scale) / 2,
  };
}
function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  return reduced;
}

function PolygonBoard({ sides, points, setPoints, result, showIdeal, onEdit }) {
  const boardRef = useRef(null),
    canvasRef = useRef(null),
    dragRef = useRef(null);
  const [keyboardCursor, setKeyboardCursor] = useState({ x: 500, y: 230 });
  const [boardFocused, setBoardFocused] = useState(false);
  useEffect(() => {
    const canvas = canvasRef.current,
      board = boardRef.current;
    const draw = () => {
      const rect = board.getBoundingClientRect(),
        dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      // Keep the logical plane isotropic: resizing cannot distort the triangle or its score.
      const { scale, x: offsetX, y: offsetY } = getView(rect, points);
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);
      const path = (vertices) => {
        ctx.beginPath();
        vertices.forEach((p, i) =>
          i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y),
        );
        if (vertices.length === sides) ctx.closePath();
      };
      if (
        result &&
        showIdeal &&
        !result.degenerate &&
        !result.selfIntersecting
      ) {
        path(fitRegularPolygon(points));
        ctx.strokeStyle = "#657f8a";
        ctx.lineWidth = 1.6 / scale;
        ctx.setLineDash([6 / scale, 6 / scale]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (points.length > 1) {
        path(points);
        if (points.length === sides) {
          ctx.fillStyle = "rgba(245,83,43,0.055)";
          ctx.fill();
        }
        ctx.strokeStyle = "#f4512b";
        ctx.lineWidth = 2.6 / scale;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.stroke();
      }
      if (boardFocused && points.length < sides) {
        const p = keyboardCursor;
        ctx.strokeStyle = "#6f7c83";
        ctx.lineWidth = 1 / scale;
        ctx.beginPath();
        ctx.moveTo(p.x - 10 / scale, p.y);
        ctx.lineTo(p.x + 10 / scale, p.y);
        ctx.moveTo(p.x, p.y - 10 / scale);
        ctx.lineTo(p.x, p.y + 10 / scale);
        ctx.stroke();
      }
      board.style.setProperty("--plane-width", `${WIDTH * scale}px`);
      board.style.setProperty("--plane-height", `${HEIGHT * scale}px`);
    };
    draw();
    const resize = new ResizeObserver(draw);
    resize.observe(board);
    return () => resize.disconnect();
  }, [sides, points, result, showIdeal, keyboardCursor, boardFocused]);
  function clampPoint(point) {
    const rect = boardRef.current.getBoundingClientRect();
    const view = getView(rect, points);
    return {
      x: Math.max(
        (MARGIN - view.x) / view.scale,
        Math.min((rect.width - MARGIN - view.x) / view.scale, point.x),
      ),
      y: Math.max(
        (MARGIN - view.y) / view.scale,
        Math.min((rect.height - MARGIN - view.y) / view.scale, point.y),
      ),
    };
  }
  function eventPoint(event) {
    const rect = boardRef.current.getBoundingClientRect();
    const view = getView(rect, points);
    return clampPoint({
      x: (event.clientX - rect.left - view.x) / view.scale,
      y: (event.clientY - rect.top - view.y) / view.scale,
    });
  }
  function pointerDown(event) {
    if (result || event.button !== 0 || dragRef.current || !event.isPrimary)
      return;
    const node = event.target.closest("[data-vertex]");
    const p = eventPoint(event);
    let index;
    if (node) {
      index = Number(node.dataset.vertex);
    } else {
      if (points.length === sides) return;
      index = points.length;
      setPoints((previous) => [...previous, p]);
      onEdit();
    }
    const original = points[index] || p;
    dragRef.current = {
      pointerId: event.pointerId,
      index,
      dx: original.x - p.x,
      dy: original.y - p.y,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    boardRef.current.setPointerCapture(event.pointerId);
    boardRef.current.dataset.dragging = String(index);
    if (node) node.focus({ preventScroll: true });
    if (event.pointerType !== "mouse") event.preventDefault();
  }
  function pointerMove(event) {
    if (result) return;
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (
      !drag.moved &&
      Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 2
    )
      return;
    if (!drag.moved) {
      drag.moved = true;
      onEdit();
    }
    const p = eventPoint(event),
      next = clampPoint({ x: p.x + drag.dx, y: p.y + drag.dy });
    setPoints((previous) =>
      previous.map((value, index) => (index === drag.index ? next : value)),
    );
  }
  function stopDrag(event) {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    delete boardRef.current.dataset.dragging;
    if (boardRef.current.hasPointerCapture(event.pointerId))
      boardRef.current.releasePointerCapture(event.pointerId);
  }
  function keyDown(event) {
    if (result) return;
    const deltas = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const node = event.target.closest("[data-vertex]"),
      delta = deltas[event.key];
    if (delta) {
      event.preventDefault();
      const amount = event.shiftKey ? 1 : 8;
      if (node) {
        const index = Number(node.dataset.vertex);
        onEdit();
        setPoints((previous) =>
          previous.map((p, i) =>
            i === index
              ? clampPoint({
                  x: p.x + delta[0] * amount,
                  y: p.y + delta[1] * amount,
                })
              : p,
          ),
        );
      } else
        setKeyboardCursor((p) =>
          clampPoint({
            x: p.x + delta[0] * amount,
            y: p.y + delta[1] * amount,
          }),
        );
    } else if (
      (event.key === "Enter" || event.key === " ") &&
      !node &&
      points.length < sides
    ) {
      event.preventDefault();
      onEdit();
      setPoints((previous) => [...previous, { ...keyboardCursor }]);
    }
  }
  return (
    <div
      className={`board ${points.length === sides ? "board--complete" : ""}`}
      ref={boardRef}
      role="group"
      aria-label={
        result
          ? `採点済みの${POLYGON_NAMES[sides]}。点の位置は確定しています。`
          : `作図エリア。クリックまたはタップで${sides}点を配置。キーボードでは矢印でカーソルを動かしEnterで配置できます。`
      }
      tabIndex={result ? -1 : 0}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
      onLostPointerCapture={stopDrag}
      onKeyDown={keyDown}
      onFocus={(e) => setBoardFocused(e.target === e.currentTarget)}
      onBlur={() => setBoardFocused(false)}
    >
      <canvas ref={canvasRef} aria-hidden="true" />
      {points.length === 0 && !boardFocused && (
        <div className="empty-state" aria-hidden="true">
          <PlusIcon size={28} weight="light" />
          <p>最初の点を、好きな場所に。</p>
          <span>クリック / タップしてスタート</span>
        </div>
      )}
      <div className="point-plane">
        {points.map((p, index) => (
          <button
            type="button"
            key={index}
            data-vertex={index}
            className="vertex"
            disabled={Boolean(result)}
            style={{
              left: `${(p.x / WIDTH) * 100}%`,
              top: `${(p.y / HEIGHT) * 100}%`,
            }}
            aria-label={
              result
                ? `点${LETTERS[index]}。採点済み、位置は確定しています。`
                : `点${LETTERS[index]}。矢印キーで移動、Shiftで微調整。`
            }
          >
            <span className="vertex-halo">
              <span className="vertex-core" />
            </span>
            <span
              className={`vertex-label ${sides > 3 ? "vertex-label--radial" : p.y < HEIGHT / 2 ? "vertex-label--top" : ""}`}
              style={
                sides > 3
                  ? (() => {
                      const center = points.reduce(
                        (s, p) => ({
                          x: s.x + p.x / points.length,
                          y: s.y + p.y / points.length,
                        }),
                        { x: 0, y: 0 },
                      );
                      const angle = Math.atan2(p.y - center.y, p.x - center.x);
                      return {
                        transform: `translate(calc(-50% + ${Math.cos(angle) * 37}px), calc(-50% + ${Math.sin(angle) * 37}px))`,
                      };
                    })()
                  : undefined
              }
            >
              {LETTERS[index]}
            </span>
          </button>
        ))}
      </div>
      {result &&
        showIdeal &&
        !result.degenerate &&
        !result.selfIntersecting && (
          <div className="ideal-legend">
            点線：いちばん近い{POLYGON_NAMES[sides]}
          </div>
        )}
    </div>
  );
}

export function App() {
  const [started, setStarted] = useState(false);
  const [sides, setSides] = useState(() => {
    const requested = Number(
      new URLSearchParams(window.location.search).get("sides"),
    );
    return SIDE_COUNTS.includes(requested) ? requested : 3;
  });
  const [points, setPoints] = useState([]),
    [result, setResult] = useState(null),
    [showIdeal, setShowIdeal] = useState(false),
    [announcement, setAnnouncement] = useState(""),
    [scoringHelp, setScoringHelp] = useState(false);
  const reduced = useReducedMotion(),
    resultRef = useRef(null),
    complete = points.length === sides,
    shapeName = POLYGON_NAMES[sides],
    message = result ? scoreMessage(result.score, sides) : null;
  useEffect(() => {
    document.title = started
      ? `SANKAKU — ${shapeName}、つくれる？`
      : "SANKAKU — 何をつくる？";
  }, [shapeName, started]);
  function edit() {
    setResult(null);
    setShowIdeal(false);
  }
  function reset() {
    setPoints([]);
    edit();
    setAnnouncement("点をリセットしました。最初の点を置いてください。");
  }
  function changeShape(event) {
    startShape(Number(event.target.value));
  }
  function startShape(next) {
    setSides(next);
    setStarted(true);
    reset();
    setAnnouncement(
      `${POLYGON_NAMES[next]}に切り替えました。${next}つの点を順に置いてください。`,
    );
    const url = new URL(window.location.href);
    if (next === 3) url.searchParams.delete("sides");
    else url.searchParams.set("sides", String(next));
    window.history.replaceState(null, "", url);
  }
  function score(event) {
    if (!complete || result) return;
    const next = evaluatePolygon(points);
    setResult(next);
    setShowIdeal(!next.degenerate && !next.selfIntersecting);
    setAnnouncement(
      `${shapeName}との一致度は${formatScore(next.score)}パーセント。${scoreMessage(next.score, sides)[0]}`,
    );
    requestAnimationFrame(() => {
      if (!reduced && event.detail !== 0)
        resultRef.current?.animate(
          [
            { opacity: 0, transform: "translateY(6px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          { duration: 220, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
        );
    });
  }
  return (
    <div className="app-shell">
      <header className="brand-row">
        <div className="brand">
          <TriangleIcon weight="bold" size={22} aria-hidden="true" />
          <span>SANKAKU</span>
        </div>
        <span className="brand-tagline">感覚で、ぴったりを探そう。</span>
        {started && (
          <label className="shape-picker">
            <span>挑戦する形</span>
            <select
              aria-label="挑戦する形"
              value={sides}
              onChange={changeShape}
            >
              {SIDE_COUNTS.map((n) => (
                <option key={n} value={n}>
                  {POLYGON_NAMES[n]}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>
      <main>
        {!started ? (
          <section className="start-screen" aria-labelledby="start-title">
            <p className="start-eyebrow">SANKAKU / 3–8 POINTS</p>
            <h1 id="start-title">何をつくる？</h1>
            <p className="start-description">
              好きな形を選んで、感覚だけでつくってみよう。
            </p>
            <div className="shape-choices" aria-label="最初に作る形を選択">
              {SIDE_COUNTS.map((n) => (
                <button
                  key={n}
                  className="shape-choice"
                  onClick={() => startShape(n)}
                >
                  <span className="shape-choice-number" aria-hidden="true">
                    0{n}
                  </span>
                  <span className="shape-choice-name">{POLYGON_NAMES[n]}</span>
                  <span className="shape-choice-caption">
                    {n}つの点でつくる
                  </span>
                  <ArrowRightIcon size={19} aria-hidden="true" />
                </button>
              ))}
            </div>
            <p className="start-note">
              点を置く → 納得いくまで調整 → 採点。
              <br />
              「もう一度」は同じ形ですぐに再挑戦できます。
            </p>
          </section>
        ) : (
          <>
            <section className="intro" aria-labelledby="game-title">
              <div>
                <h1 id="game-title">{shapeName}、つくれる？</h1>
                <p>
                  {sides}つの点を置いて、{shapeName}
                  にどれだけ近いかを探しましょう。
                  <br className="desktop-break" />
                  点は採点前まで、ドラッグして調整できます。
                </p>
              </div>
              {result && (
                <div className="result" ref={resultRef}>
                  <span className="result-eyebrow">{shapeName}との一致度</span>
                  <div className="result-number">
                    <strong>{formatScore(result.score)}</strong>
                    <span>%</span>
                  </div>
                  <p className="result-message">{message[0]}</p>
                </div>
              )}
            </section>
            <PolygonBoard
              key={sides}
              sides={sides}
              points={points}
              setPoints={setPoints}
              result={result}
              showIdeal={showIdeal}
              onEdit={edit}
            />
            <section className="action-bar" aria-label="ゲームの操作">
              <div
                className={`progress ${sides > 3 ? "progress--many" : ""}`}
                aria-label={`${sides}点中${points.length}点配置済み`}
              >
                <ol>
                  {LETTERS.slice(0, sides).map((letter, i) => (
                    <li
                      key={letter}
                      className={`${points.length >= i + 1 ? "is-placed" : ""} ${points.length === i + 1 ? "is-current" : ""}`}
                      aria-label={`点${letter}${points.length >= i + 1 ? "配置済み" : "未配置"}`}
                    >
                      <span>{i + 1}</span>
                    </li>
                  ))}
                </ol>
                <p>
                  {result
                    ? "採点できました"
                    : complete
                      ? `${sides}点を配置しました`
                      : `${points.length === 0 ? "最初" : `${points.length + 1}つ目`}の点を置こう`}
                </p>
              </div>
              <div className="action-hint">
                {result ? (
                  <label className="ideal-toggle">
                    <input
                      type="checkbox"
                      checked={showIdeal}
                      onChange={(e) => setShowIdeal(e.target.checked)}
                      disabled={result.degenerate || result.selfIntersecting}
                    />
                    <span>{shapeName}を重ねる</span>
                  </label>
                ) : (
                  <>
                    <HandPointingIcon
                      size={25}
                      weight="light"
                      aria-hidden="true"
                    />
                    <span>
                      {complete
                        ? "点をドラッグして調整"
                        : "好きな場所をクリック / タップ"}
                    </span>
                  </>
                )}
              </div>
              <div className="actions">
                {result ? (
                  <button
                    className="primary-button"
                    onClick={(event) => {
                      if (event.detail < 2) reset();
                    }}
                  >
                    <span>もう一度つくる</span>
                    <ArrowRightIcon size={22} aria-hidden="true" />
                  </button>
                ) : (
                  <button
                    className="primary-button"
                    onClick={score}
                    disabled={!complete}
                  >
                    <span>採点する</span>
                    <ArrowRightIcon size={22} aria-hidden="true" />
                  </button>
                )}
                {!result && (
                  <button
                    className="text-button reset-button"
                    onClick={reset}
                    disabled={points.length === 0}
                  >
                    <ArrowCounterClockwiseIcon size={17} aria-hidden="true" />
                    <span>やり直す</span>
                  </button>
                )}
              </div>
            </section>
            {result && (
              <ShareResult
                key={`${sides}-${result.score}-${points.map((p) => `${p.x},${p.y}`).join(";")}`}
                points={points}
                result={result}
                sides={sides}
              />
            )}
          </>
        )}
      </main>
      {started && (
        <footer className="footer-row">
          <p>
            {result?.degenerate
              ? "点が一直線、または重なっています。広げて再挑戦してみよう。"
              : result?.selfIntersecting
                ? "辺が交差しています。外周をたどる順に点を並べてみよう。"
                : result
                  ? message[1]
                  : "大きさ・向きは採点に影響しません。"}
          </p>
          <div className="footer-actions">
            {!result && points.length > 0 && (
              <button
                className="text-button undo-button"
                aria-label="最後に置いた1点を戻す"
                onClick={() => {
                  setPoints((previous) => previous.slice(0, -1));
                  edit();
                }}
              >
                <ArrowUUpLeftIcon size={15} aria-hidden="true" />
                <span>1点戻す</span>
              </button>
            )}
            <button
              className="text-button about-button"
              aria-expanded={scoringHelp}
              aria-controls="scoring-explanation"
              onClick={() => setScoringHelp((value) => !value)}
            >
              採点について
            </button>
          </div>
        </footer>
      )}
      {scoringHelp && (
        <section className="scoring-explanation" id="scoring-explanation">
          <h2>辺と面積で、形を採点。</h2>
          <p>
            一致度 = 4 × tan(π ÷ 角の数) × 面積 ÷（各辺の長さの2乗の合計）×
            100。{shapeName}
            で100%、一直線につぶれると0%になります。位置・大きさ・向きは問いません。三角形の採点は従来と同じです。
          </p>
          <p>
            点は外周に沿う順で置いてください。辺が交差している場合は0%です。点線は、頂点のずれの合計が最小になるように重ねた
            {shapeName}
            です。頂点をTabで選び、矢印キーでも調整できます。Shiftを押しながらで微調整。
          </p>
        </section>
      )}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </div>
    </div>
  );
}
