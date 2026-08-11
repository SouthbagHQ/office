CREATE TABLE oauth_clients (
  issuer TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  client_id TEXT NOT NULL,
  client_secret TEXT,
  PRIMARY KEY (issuer, redirect_uri)
);
