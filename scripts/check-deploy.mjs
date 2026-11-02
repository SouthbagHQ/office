// Production deploys must have the central freeze wired: without IDENTITY_INTERNAL_SECRET the
// check silently turns off and frozen accounts could use the service. Runs before wrangler deploy.
import { execSync } from 'node:child_process';
const out = execSync('npx wrangler secret list --format json 2>/dev/null || echo "[]"', { encoding: 'utf8' });
const names = JSON.parse(out).map(s => s.name);
if (!names.includes('IDENTITY_INTERNAL_SECRET')) {
  console.error('IDENTITY_INTERNAL_SECRET is not set on this worker. `wrangler secret put IDENTITY_INTERNAL_SECRET` with Office\'s entry from Identity\'s INTERNAL_API_SECRETS (key "southbag-office"). Refusing to deploy with the account freeze off.');
  process.exit(1);
}
console.log('deploy check ok: account freeze is wired');
