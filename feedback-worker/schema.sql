CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('problem','suggestion','other')),
  message TEXT NOT NULL,
  tester TEXT NOT NULL DEFAULT '',
  screen TEXT NOT NULL,
  app_version TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','ready')),
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','todo','resolved')),
  images TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS feedback_created ON feedback(state, created_at DESC);
CREATE TABLE IF NOT EXISTS feedback_limits (
  bucket TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
