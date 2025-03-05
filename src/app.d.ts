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

declare module '@mozilla/readability' {
  export class Readability {
    constructor(document: Document, options?: object);
    parse(): {
      title: string;
      content: string;
      textContent: string;
      excerpt: string;
      length: number;
      siteName: string;
    } | null;
  }
}

export {};