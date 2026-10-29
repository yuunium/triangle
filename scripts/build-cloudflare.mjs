import { spawnSync } from "node:child_process";
const build = spawnSync(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "build"],
  {
    stdio: "inherit",
    env: { ...process.env, VITE_RANKING_ENABLED: "true" },
  },
);
process.exit(build.status ?? 1);
