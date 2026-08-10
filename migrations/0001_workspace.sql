CREATE TABLE IF NOT EXISTS workspaces (
  owner_key TEXT PRIMARY KEY NOT NULL,
  data TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS workspaces_updated_at_idx ON workspaces(updated_at);
