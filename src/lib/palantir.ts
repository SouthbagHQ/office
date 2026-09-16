/**
 * Client-side PostHog events. `/palantir.js` (loaded from the root layout) owns the
 * PostHog instance; this is a safe wrapper for components, no-op during SSR or before load.
 */
export function track(event: string, properties?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  window.palantir?.capture(event, properties);
}
