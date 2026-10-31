import { mkdir, writeFile } from "node:fs/promises";
const target = "https://nanakaku.linetoslack.workers.dev/";
await mkdir("dist/pages", { recursive: true });
await writeFile(
  "dist/pages/index.html",
  `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>NANAKAKU — 移転しました</title><link rel="canonical" href="${target}">
<meta http-equiv="refresh" content="0;url=${target}"></head>
<body><p>NANAKAKUはこちらです。<a href="${target}">ゲームを開く</a></p>
<script>window.location.replace(${JSON.stringify(target)} + window.location.search + window.location.hash);</script>
</body></html>`,
);
console.log(`GitHub Pages redirect prepared: ${target}`);
