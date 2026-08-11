type Row = { client_id: string; client_secret: string | null };

export async function oauthClient(db: D1Database, fetch: typeof globalThis.fetch, issuer: string, redirectUri: string, appOrigin: string) {
  const find = () => db
    .prepare('SELECT client_id, client_secret FROM oauth_clients WHERE issuer = ? AND redirect_uri = ?')
    .bind(issuer, redirectUri)
    .first<Row>();
  const existing = await find();
  if (existing) return { clientId: existing.client_id, clientSecret: existing.client_secret };

  const metadataResponse = await fetch(new URL('/.well-known/openid-configuration', issuer));
  const metadata = (await metadataResponse.json().catch(() => ({}))) as { registration_endpoint?: string };
  if (!metadataResponse.ok || !metadata.registration_endpoint) throw new Error('Identity does not advertise client registration.');

  const endpoint = new URL(metadata.registration_endpoint);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: endpoint.origin },
    body: JSON.stringify({
      redirect_uris: [redirectUri],
      client_name: 'Southbag Office™',
      client_uri: appOrigin,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code'],
      response_types: ['code'],
      scope: 'openid profile email'
    })
  });
  const registered = (await response.json().catch(() => ({}))) as { client_id?: string; client_secret?: string; error_description?: string };
  if (!response.ok || !registered.client_id) throw new Error(registered.error_description || 'Identity client registration failed.');

  await db
    .prepare('INSERT OR IGNORE INTO oauth_clients (issuer, redirect_uri, client_id, client_secret) VALUES (?, ?, ?, ?)')
    .bind(issuer, redirectUri, registered.client_id, registered.client_secret ?? null)
    .run();
  const stored = await find();
  if (!stored) throw new Error('Identity client registration was not stored.');
  return { clientId: stored.client_id, clientSecret: stored.client_secret };
}
