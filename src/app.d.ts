declare global {
  namespace App {
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
