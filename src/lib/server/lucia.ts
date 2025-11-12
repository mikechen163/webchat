import { lucia } from "lucia";
import { prisma } from "@lucia-auth/adapter-prisma";
import { PrismaClient } from "@prisma/client";
import { dev } from "$app/environment";

const prismaClient = new PrismaClient();

export const luciaAuth = lucia({
  env: dev ? "DEV" : "PROD",
  middleware: "sveltekit",
  adapter: prisma(prismaClient),
  sessionCookie: {
    expires: false,
    attributes: {
      secure: !dev // 生产环境使用HTTPS
    }
  },
  getUserAttributes: (databaseUser) => {
    return {
      id: databaseUser.id,
      email: databaseUser.email,
      name: databaseUser.name,
      role: databaseUser.role,
      language: databaseUser.language,
      theme: databaseUser.theme
    };
  }
});

export type Auth = typeof luciaAuth;