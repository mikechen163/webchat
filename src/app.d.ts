// src/app.d.ts
/// <reference types="lucia" />
declare global {
  interface Window {
    katex?: any;
  }

  namespace App {
    interface Locals {
      auth: {
        session: import("lucia").Session | null;
        user: App.User | null;
      };
    }
    
    interface User {
      id: string;
      email: string;
      name: string | null;
      role: string;
      language: string;
      theme: string;
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