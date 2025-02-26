// src/lib/server/prisma.ts
import { PrismaClient } from "@prisma/client";

declare global {
  // 防止重复实例化
  var prisma: PrismaClient | undefined;
}

export const prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}