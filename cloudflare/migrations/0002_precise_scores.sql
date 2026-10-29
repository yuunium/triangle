-- Keep the existing display/ranking score and preserve the unrounded value separately.
ALTER TABLE rounds ADD COLUMN score_raw REAL CHECK(score_raw >= 0 AND score_raw <= 100);
ALTER TABLE records ADD COLUMN score_raw REAL CHECK(score_raw >= 0 AND score_raw <= 100);
