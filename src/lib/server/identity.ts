// The account-level freeze lives in Southbag Identity. Office only enforces the central answer,
// checked FRESH on every request (no cache: a cached 'active' answer is an authorization window
// a just-frozen user could keep using).
//
// Availability policy:
// - Secret NOT CONFIGURED: 'off', the central check is skipped. Development only - production
//   deploys must fail without it (scripts/check-deploy.mjs runs before wrangler deploy).
// - Configured but Identity UNREACHABLE (or rejecting our secret): 'unknown'. EVERYTHING
//   private is refused (503), reads included - fail closed. Office documents are private
//   account data. The unfreeze flow at Identity stays reachable.
// - Known FROZEN: the account is blocked entirely, reads included (423).

export type CentralAnswer = 'off' | 'unknown' | { frozen: boolean };

export async function centralStatus(
	env: Record<string, string | undefined>,
	userId: string,
	fetcher: typeof fetch = fetch
): Promise<CentralAnswer> {
	const secret = env.IDENTITY_INTERNAL_SECRET;
	if (!secret) return 'off';
	try {
		const origin = env.IDENTITY_ORIGIN || 'https://identity.southbag.cc';
		const response = await fetcher(`${origin}/api/internal/freeze?userId=${encodeURIComponent(userId)}`, {
			headers: { authorization: `Bearer ${secret}` }
		});
		if (response.status === 401 || response.status === 403) {
			// Loud and distinct: the secret is wrong or rotated, which a presence-only deploy
			// guard cannot catch. Still fails closed, but this is the log line to page on.
			console.error(`identity status REJECTED the configured secret (HTTP ${response.status}) - check IDENTITY_INTERNAL_SECRET`);
			return 'unknown';
		}
		if (!response.ok) throw new Error(`identity status ${response.status}`);
		return { frozen: !!((await response.json()) as { frozen?: boolean }).frozen };
	} catch (error) {
		console.error('identity status failed', error);
		return 'unknown';
	}
}

export const FROZEN_TEXT =
	'Your account is frozen pending review. Unfreeze at https://identity.southbag.cc/unfreeze';
export const STATUS_UNKNOWN_TEXT =
	'Southbag Identity is unavailable, so your account status cannot be checked. Try again shortly.';
