import { useEffect, useRef, useState } from "react";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react/dist/csr/ArrowCounterClockwise";
import { ArrowUUpLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowUUpLeft";
import { HandPointingIcon } from "@phosphor-icons/react/dist/csr/HandPointing";
import { TriangleIcon } from "@phosphor-icons/react/dist/csr/Triangle";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import {
  evaluateTriangle,
  fitEquilateral,
  formatScore,
  scoreMessage,
} from "./geometry.mjs";

const LETTERS = ["A", "B", "C"];
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

function TriangleBoard({ points, setPoints, result, showIdeal, onEdit }) {
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
      ctx.fillStyle = "#dce0df";
      for (let x = 8; x < rect.width; x += 36)
        for (let y = 10; y < rect.height; y += 36) {
          ctx.beginPath();
          ctx.arc(x, y, 1.15, 0, Math.PI * 2);
          ctx.fill();
        }
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);
      const path = (vertices) => {
        ctx.beginPath();
        vertices.forEach((p, i) =>
          i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y),
        );
        if (vertices.length === 3) ctx.closePath();
      };
      if (result && showIdeal && !result.degenerate) {
        path(fitEquilateral(points));
        ctx.strokeStyle = "#657f8a";
        ctx.lineWidth = 1.6 / scale;
        ctx.setLineDash([6 / scale, 6 / scale]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (points.length > 1) {
        path(points);
        if (points.length === 3) {
          ctx.fillStyle = "rgba(245,83,43,0.055)";
          ctx.fill();
        }
        ctx.strokeStyle = "#f4512b";
        ctx.lineWidth = 2.6 / scale;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.stroke();
      }
      if (boardFocused && points.length < 3) {
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
  }, [points, result, showIdeal, keyboardCursor, boardFocused]);
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
    if (event.button !== 0 || dragRef.current || !event.isPrimary) return;
    const node = event.target.closest("[data-vertex]");
    const p = eventPoint(event);
    let index;
    if (node) {
      index = Number(node.dataset.vertex);
    } else {
      if (points.length === 3) return;
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
      points.length < 3
    ) {
      event.preventDefault();
      onEdit();
      setPoints((previous) => [...previous, { ...keyboardCursor }]);
    }
  }
  return (
    <div
      className={`board ${points.length === 3 ? "board--complete" : ""}`}
      ref={boardRef}
      role="group"
      aria-label="作図エリア。クリックまたはタップで3点を配置。キーボードでは矢印でカーソルを動かしEnterで配置できます。"
      tabIndex={0}
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
            style={{
              left: `${(p.x / WIDTH) * 100}%`,
              top: `${(p.y / HEIGHT) * 100}%`,
            }}
            aria-label={`点${LETTERS[index]}。矢印キーで移動、Shiftで微調整。`}
          >
            <span className="vertex-halo">
              <span className="vertex-core" />
            </span>
            <span
              className={`vertex-label ${p.y < HEIGHT / 2 ? "vertex-label--top" : ""}`}
            >
              {LETTERS[index]}
            </span>
          </button>
        ))}
      </div>
      {result && showIdeal && !result.degenerate && (
        <div className="ideal-legend">点線：いちばん近い正三角形</div>
      )}
    </div>
  );
}

export function App() {
  const [points, setPoints] = useState([]),
    [result, setResult] = useState(null),
    [showIdeal, setShowIdeal] = useState(false),
    [announcement, setAnnouncement] = useState(""),
    [scoringHelp, setScoringHelp] = useState(false);
  const reduced = useReducedMotion(),
    resultRef = useRef(null),
    complete = points.length === 3,
    message = result ? scoreMessage(result.score) : null;
  function edit() {
    setResult(null);
    setShowIdeal(false);
  }
  function reset() {
    setPoints([]);
    edit();
    setAnnouncement("点をリセットしました。最初の点を置いてください。");
  }
  function score(event) {
    if (!complete) return;
    const next = evaluateTriangle(points);
    setResult(next);
    setShowIdeal(false);
    setAnnouncement(
      `正三角形との一致度は${formatScore(next.score)}パーセント。${scoreMessage(next.score)[0]}`,
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
        <span className="brand-tagline">感覚で、60°を探そう。</span>
      </header>
      <main>
        <section className="intro" aria-labelledby="game-title">
          <div>
            <h1 id="game-title">正三角形、つくれる？</h1>
            <p>
              3つの点を置いて、正三角形にどれだけ近いかを探しましょう。
              <br className="desktop-break" />
              点は、あとからドラッグして調整できます。
            </p>
          </div>
          {result && (
            <div className="result" ref={resultRef}>
              <span className="result-eyebrow">正三角形との一致度</span>
              <div className="result-number">
                <strong>{formatScore(result.score)}</strong>
                <span>%</span>
              </div>
              <p className="result-message">{message[0]}</p>
            </div>
          )}
        </section>
        <TriangleBoard
          points={points}
          setPoints={setPoints}
          result={result}
          showIdeal={showIdeal}
          onEdit={edit}
        />
        <section className="action-bar" aria-label="ゲームの操作">
          <div className="progress" aria-label={`${points.length}点配置済み`}>
            <ol>
              {LETTERS.map((letter, i) => (
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
                  ? "3点を配置しました"
                  : `${["最初", "2つ目", "3つ目"][points.length]}の点を置こう`}
            </p>
          </div>
          <div className="action-hint">
            {result ? (
              <label className="ideal-toggle">
                <input
                  type="checkbox"
                  checked={showIdeal}
                  onChange={(e) => setShowIdeal(e.target.checked)}
                  disabled={result.degenerate}
                />
                <span>正三角形を重ねる</span>
              </label>
            ) : (
              <>
                <HandPointingIcon size={25} weight="light" aria-hidden="true" />
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
              <button className="primary-button" onClick={reset}>
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
            <button
              className="text-button reset-button"
              onClick={result ? edit : reset}
              disabled={points.length === 0}
            >
              <ArrowCounterClockwiseIcon size={17} aria-hidden="true" />
              <span>{result ? "調整を続ける" : "やり直す"}</span>
            </button>
          </div>
        </section>
      </main>
      <footer className="footer-row">
        <p>
          {result?.degenerate
            ? "点が一直線、または重なっています。広げて再挑戦してみよう。"
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
      {scoringHelp && (
        <section className="scoring-explanation" id="scoring-explanation">
          <h2>3つの辺と面積で、形を採点。</h2>
          <p>
            一致度 = 4√3 × 面積 ÷（3辺それぞれの長さの2乗の合計）×
            100。正三角形で100%、一直線につぶれると0%になります。位置・大きさ・向きは問いません。
          </p>
          <p>
            点線は、3点のずれの合計が最小になるように重ねた正三角形です。頂点をTabで選び、矢印キーでも調整できます。Shiftを押しながらで微調整。
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
