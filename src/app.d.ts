declare global {
  namespace App {
    interface Platform {
      env: {
        DB: D1Database;
        SOUTHBAG_FILE_KEY?: string;
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
