declare global {
  namespace App {
    interface Platform {
      env: {
        DB: D1Database;
      };
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
}

export {};
