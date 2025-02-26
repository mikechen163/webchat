import { Lucia } from "lucia";
import { PrismaAdapter } from "@lucia-auth/adapter-prisma";
import { PrismaClient } from "@prisma/client";
import { dev } from "$app/environment";

const client = new PrismaClient();

// Use the correct table names from your schema
const adapter = new PrismaAdapter(client.authSession, client.key, client.user);

export const auth = new Lucia(adapter, {
  sessionCookie: {
    expires: false,
    attributes: {
      secure: !dev
    }
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