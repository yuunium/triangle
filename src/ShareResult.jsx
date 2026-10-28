import { useEffect, useRef, useState } from "react";
import { ShareNetworkIcon } from "@phosphor-icons/react/dist/csr/ShareNetwork";
import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/csr/DownloadSimple";
import { XLogoIcon } from "@phosphor-icons/react/dist/csr/XLogo";
import {
  challengeUrl,
  createResultImage,
  resultShareText,
  tweetIntent,
} from "./result-image.mjs";

export function ShareResult({ points, result, sides }) {
  const [image, setImage] = useState(null),
    [open, setOpen] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const panelRef = useRef(null);
  useEffect(() => {
    let cancelled = false,
      url;
    createResultImage(points, sides, result.score)
      .then((data) => {
        if (cancelled) return;
        url = URL.createObjectURL(data.blob);
        setImage({ ...data, url });
      })
      .catch(() => {
        if (!cancelled)
          setError(
            "画像を作成できませんでした。新しい図形で、もう一度お試しください。",
          );
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [points, result, sides]);
  useEffect(() => {
    if (open)
      panelRef.current?.scrollIntoView({
        block: "nearest",
        behavior: "instant",
      });
  }, [open]);
  let canShareImage = false;
  try {
    canShareImage = Boolean(
      image && navigator.share && navigator.canShare?.({ files: [image.file] }),
    );
  } catch {
    /* Fall back to a PNG download and the X composer. */
  }
  async function share() {
    if (!image || busy) return;
    if (!canShareImage) {
      setOpen(true);
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      // Call synchronously from this user gesture; generating the PNG here would lose activation.
      await navigator.share({
        files: [image.file],
        title: "SANKAKUの結果",
        text: `${resultShareText(sides, result.score)}\n${challengeUrl(sides)}`,
      });
      setMessage("共有メニューを開きました。投稿は共有先で確定してください。");
    } catch (err) {
      if (err.name !== "AbortError") {
        setMessage("画像の共有を開けませんでした。保存して投稿できます。");
        setOpen(true);
      }
    } finally {
      setBusy(false);
    }
  }
  function save() {
    if (!image) return;
    const link = document.createElement("a");
    link.href = image.url;
    link.download = image.filename;
    document.body.append(link);
    link.click();
    link.remove();
    setMessage(
      "画像のダウンロードを開始しました。Xの投稿画面で、この画像を添付してください。",
    );
  }
  return (
    <section className="result-sharing" aria-label="採点結果の共有">
      <div className="share-toolbar">
        <span className="score-locked">この回の採点は確定しました</span>
        <div className="share-toolbar-actions">
          <button
            className="share-button"
            onClick={share}
            disabled={!image || busy}
          >
            <ShareNetworkIcon size={18} aria-hidden="true" />
            {busy
              ? "共有を開いています…"
              : image
                ? "結果を画像でシェア"
                : error
                  ? "画像を作成できません"
                  : "画像を準備中…"}
          </button>
          <button
            className="text-button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="result-share-panel"
          >
            画像保存・Xに投稿
          </button>
        </div>
      </div>
      {open && (
        <div className="share-panel" id="result-share-panel" ref={panelRef}>
          {image && (
            <img
              src={image.url}
              width="1200"
              height="675"
              alt="確定した図形と一致度の結果画像"
            />
          )}
          <div className="share-panel-copy">
            <h2>この形、見せてみよう。</h2>
            <p>
              ① 結果画像を保存
              <br />② Xの投稿画面で画像を添付
            </p>
            <div className="share-panel-actions">
              <button className="share-button" onClick={save} disabled={!image}>
                <DownloadSimpleIcon size={18} aria-hidden="true" />
                画像を保存
              </button>
              <a
                className="share-button share-button--x"
                href={tweetIntent(sides, result.score)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <XLogoIcon size={17} aria-hidden="true" />
                Xの投稿画面へ
              </a>
            </div>
            <p className="share-note">
              本文とゲームのリンクを入力済みで開きます。画像は投稿画面で添付してください。
            </p>
          </div>
        </div>
      )}
      {(message || error) && (
        <p className="share-status" role="status">
          {error || message}
        </p>
      )}
    </section>
  );
}
