export const RANKING_ENABLED = import.meta.env?.VITE_RANKING_ENABLED === "true";
export async function rankingRequest(path, body) {
  const response = await fetch(`/api/${path}`, {
    credentials: "same-origin",
    cache: "no-store",
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("ランキングに接続できませんでした。");
  }
  if (!response.ok)
    throw new Error(
      data.error || "通信に失敗しました。もう一度お試しください。",
    );
  return data;
}
