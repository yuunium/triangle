import { test } from "node:test";
import assert from "node:assert/strict";
import {
  challengeUrl,
  resultShareText,
  tweetIntent,
} from "../src/result-image.mjs";
test("X composer uses the selected shape, finalized score and matching challenge link", () => {
  const url = new URL(tweetIntent(8, 98.125));
  assert.equal(url.origin, "https://x.com");
  assert.equal(url.pathname, "/intent/tweet");
  assert.ok(url.searchParams.get("text").includes("正八角形との一致度 98.13%"));
  assert.equal(
    url.searchParams.get("url"),
    "https://yuunium.github.io/triangle/?sides=8",
  );
  assert.ok(resultShareText(4, 80).includes("正方形"));
});
test("triangle challenge retains the original URL and no false 100 percent is shared", () => {
  assert.equal(challengeUrl(3), "https://yuunium.github.io/triangle/");
  assert.ok(resultShareText(3, 99.99998).includes("99.99%"));
});
