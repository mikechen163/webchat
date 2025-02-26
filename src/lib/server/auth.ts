import { Lucia } from "lucia";
import { PrismaAdapter } from "@lucia-auth/adapter-prisma";
import { PrismaClient } from "@prisma/client";
import { dev } from "$app/environment";

const client = new PrismaClient();

// 创建 auth 实例
export const auth = new Lucia({
  adapter: new PrismaAdapter(client),
  env: dev ? "DEV" : "PROD",
  getUserAttributes: (data) => {
    return {
      email: data.email,
      role: data.role,
    };
  },
});

export type Auth = typeof auth;