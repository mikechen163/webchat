import { Lucia } from "lucia";
import { PrismaAdapter } from "@lucia-auth/adapter-prisma";
import { PrismaClient } from "@prisma/client";
import { dev } from "$app/environment";

const client = new PrismaClient();
const adapter = new PrismaAdapter(client);

export const auth = new Lucia({
  env: dev ? "DEV" : "PROD",
  adapter: adapter,
    sessionCookie: {
    expires: false
  },
  getUserAttributes: (data) => {
    return {
      email: data.email,
      role: data.role
    };
  }
});

declare module "lucia" {
  interface Register {
    Lucia: typeof auth;
    DatabaseUserAttributes: {
      email: string;
      role: string;
    };
  }
}

export type Auth = typeof auth;