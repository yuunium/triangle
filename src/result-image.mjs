import {
  POLYGON_NAMES,
  MAIN_SIDES,
  formatScore,
  scoreMessage,
} from "./geometry.mjs";

export const GAME_URL =
  import.meta.env?.VITE_RANKING_ENABLED === "true" &&
  typeof window !== "undefined"
    ? new URL("/", window.location.href).href
    : "https://yuunium.github.io/triangle/";
export function resultShareText(sides, score) {
  return `${POLYGON_NAMES[sides]}との一致度 ${formatScore(score)}%！\n感覚で、ぴったりを探そう。 #SANKAKU`;
}
export function challengeUrl(sides) {
  const url = new URL(GAME_URL);
  if (sides !== MAIN_SIDES) url.searchParams.set("sides", String(sides));
  return url.href;
}
export function tweetIntent(sides, score) {
  const url = new URL("https://x.com/intent/tweet");
  url.searchParams.set("text", resultShareText(sides, score));
  url.searchParams.set("url", challengeUrl(sides));
  return url.href;
}

// Draw the actual, finalized game geometry; this is not a screenshot of the UI.
export async function createResultImage(points, sides, score) {
  const name = POLYGON_NAMES[sides];
  const font = '"Noto Sans JP Variable", sans-serif';
  if (document.fonts) {
    try {
      await document.fonts.load(
        `600 24px ${font}`,
        `${name}との一致度${scoreMessage(score, sides)[0]}感覚でぴったりを探そう。`,
      );
    } catch {
      /* System font remains a usable fallback. */
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 675;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("このブラウザーでは結果画像を作成できません。");
  ctx.fillStyle = "#fafaf8";
  ctx.fillRect(0, 0, 1200, 675);
  ctx.fillStyle = "#1c2a33";
  ctx.font = `600 21px ${font}`;
  ctx.fillText("S A N K A K U", 58, 66);
  ctx.fillStyle = "#6b7780";
  ctx.font = `400 18px ${font}`;
  ctx.fillText(`${sides} POINTS CHALLENGE`, 58, 102);
  ctx.fillStyle = "#1c2a33";
  ctx.font = `600 27px ${font}`;
  ctx.fillText(`${name}との一致度`, 58, 233);
  const scoreText = formatScore(score);
  ctx.fillStyle = "#f4512b";
  ctx.font = `650 94px ${font}`;
  ctx.fillText(scoreText, 52, 349);
  const textWidth = ctx.measureText(scoreText).width;
  ctx.font = `500 34px ${font}`;
  ctx.fillText("%", 62 + textWidth, 348);
  ctx.fillStyle = "#1c2a33";
  ctx.font = `500 22px ${font}`;
  ctx.fillText(scoreMessage(score, sides)[0], 58, 409);
  ctx.fillStyle = "#6b7780";
  ctx.font = `400 18px ${font}`;
  ctx.fillText("感覚で、ぴったりを探そう。", 58, 564);
  ctx.font = `400 15px ${font}`;
  ctx.fillText("yuunium.github.io/triangle", 58, 607);

  const minX = Math.min(...points.map((p) => p.x)),
    maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y)),
    maxY = Math.max(...points.map((p) => p.y));
  const scale = Math.min(
    510 / Math.max(1, maxX - minX),
    430 / Math.max(1, maxY - minY),
  );
  const vertices = points.map((p) => ({
    x: 852 + (p.x - (minX + maxX) / 2) * scale,
    y: 337 + (p.y - (minY + maxY) / 2) * scale,
  }));
  ctx.beginPath();
  vertices.forEach((p, i) =>
    i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y),
  );
  ctx.closePath();
  ctx.fillStyle = "rgba(244,81,43,0.055)";
  ctx.fill();
  ctx.strokeStyle = "#f4512b";
  ctx.lineWidth = 3.5;
  ctx.lineJoin = "round";
  ctx.stroke();
  vertices.forEach((p, i) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(244,81,43,0.09)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#f4512b";
    ctx.fill();
    ctx.strokeStyle = "#fafaf8";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#1c2a33";
    ctx.font = `600 16px ${font}`;
    ctx.textAlign = "center";
    const angle = Math.atan2(p.y - 337, p.x - 852);
    ctx.fillText(
      String.fromCharCode(65 + i),
      p.x + Math.cos(angle) * 33,
      p.y + Math.sin(angle) * 33 + 6,
    );
  });
  ctx.textAlign = "left";
  ctx.strokeStyle = "#d0d5d6";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(58, 631);
  ctx.lineTo(1142, 631);
  ctx.stroke();
  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (value) =>
        value
          ? resolve(value)
          : reject(new Error("結果画像の生成に失敗しました。")),
      "image/png",
    ),
  );
  const filename = `sankaku-${sides}-${scoreText.replace(".", "-")}.png`;
  return {
    blob,
    file: new File([blob], filename, { type: "image/png" }),
    filename,
  };
}
