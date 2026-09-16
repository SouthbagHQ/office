declare global {
  namespace App {
    interface Platform {
      env: {
        DB: D1Database;
        SOUTHBAG_FILE_KEY?: string;
      };
      context?: { waitUntil(promise: Promise<unknown>): void };
    }
    interface Locals {
      user: {
        sub: string;
        name: string;
        email: string;
        picture?: string;
      } | null;
    }
  }

  interface Window {
    /** Southbag's PostHog wiring, defined by /palantir.js. */
    palantir?: {
      capture(event: string, properties?: Record<string, unknown>): void;
      identify(user: { id: string; email?: string; name?: string }): void;
      reset(): void;
    };
    posthog?: {
      register(properties: Record<string, unknown>): void;
      __loaded?: boolean;
    };
  }
}

export {};
