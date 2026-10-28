# SANKAKU

感覚で、60°を探そう。3つの点を置いて、正三角形を目指すブラウザーゲームです。

## 遊び方

1. 盤面をクリック／タップして、A・B・Cの順に3点を配置。
2. 点をドラッグして、納得いくまで調整。
3. 「採点する」で正三角形との一致度を表示。
4. 採点後は正三角形を重ねて確認したり、同じ点の調整を続けたりできます。

マウス・タッチ・キーボード対応。盤面にTabでフォーカスし、矢印でカーソルを動かしてEnterで点を配置できます。配置済みの点もTabで選び、矢印で移動できます。Shift＋矢印は微調整です。

## ローカル開発

Node.js 22以上を使用します。

```sh
npm ci
npm run dev
```

```sh
npm test          # 採点・正三角形フィットのテスト
npm run build    # 静的ファイルを dist/client に出力
npm run preview  # 本番ビルドのプレビュー
```

React + Vite。サーバーや環境変数、外部APIへの接続は不要です。アイコンと日本語フォントもビルドに同梱されます。

## GitHub Pages

`.github/workflows/pages.yml` が、mainへのpush時にテスト・ビルド・デプロイを実行します。

GitHubリポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** に設定してください。その後mainにpushするか、Actionsの **Deploy GitHub Pages → Run workflow** を実行します。

このリポジトリの公開先は `https://yuunium.github.io/triangle/` です。公開の成否はActionsの実行結果で確認できます。

Viteの`base: './'`により、リポジトリ名の付いたサブパスでもアセットを読み込めます。GitHub Pagesに必要なのは`dist/client`の静的ファイルだけです。テンプレート由来の`worker/`と`.openai/`は、将来別のホスティングへ移す場合に備えて残しています。

## 採点

3辺の長さをa,b,c、面積をAとして、以下を計算します。

```text
一致度 [%] = 100 × 4√3 × A / (a² + b² + c²)
```

位置・大きさ・回転・鏡映には依存しません。正三角形は100%、一直線または全点が重なる場合は0%。直角二等辺三角形は約86.60%です。

表示は小数点以下2桁。完全一致と区別するため、100%未満の値が丸めで100.00%になる場合は99.99%と表示します。浮動小数点誤差の許容範囲はスコアで1e-10です。

採点後の点線は、重心を保った最小二乗の正三角形です。これはずれを見比べるためのガイドで、採点式そのものとは別です。

## 将来のランキング

採点はReactに依存しない`src/geometry.mjs`にまとめています。Cloudflare Workersなどでも同じモジュールを利用できます。`SCORING_VERSION`は`equilateral-q-v1`です。

追加時の想定構成は **GitHub Pages（ゲーム）→ Cloudflare Worker（ランキングAPI）→ D1（記録）**。送信データは3頂点の座標・採点バージョン・表示名を基本とし、サーバーで一致度を再計算して保存します。現在はAPI・データベース・ランキング機能を接続していません。

## デザイン

選択した白地とオレンジの案に沿って、盤面を主役にした構成です。[Emil Kowalskiのデザイン指針](https://github.com/emilkowalski/skills)を参考に、直接追従するドラッグ、短い押下フィードバック、目的のある結果表示、reduced-motion対応を実装しています。
