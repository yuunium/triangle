CREATE TABLE rounds (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  consumed_at INTEGER,
  name TEXT,
  score REAL,
  points_json TEXT
);
CREATE INDEX rounds_expiry ON rounds(created_at);

CREATE TABLE records (
  player_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  score REAL NOT NULL CHECK(score >= 0 AND score <= 100),
  achieved_at INTEGER NOT NULL,
  round_id TEXT NOT NULL UNIQUE,
  points_json TEXT NOT NULL,
  scoring_version TEXT NOT NULL
);
CREATE INDEX records_ranking ON records(scoring_version, score DESC, achieved_at ASC);
