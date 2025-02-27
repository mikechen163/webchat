// src/app.d.ts
/// <reference types="lucia" />
declare global {
  namespace App {
    interface Locals {
      auth: import("lucia").AuthRequest;
      user: import("lucia").User | null;
      session: import("lucia").Session | null;
    }
  }
}

export {};