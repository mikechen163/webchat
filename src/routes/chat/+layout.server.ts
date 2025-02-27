import { PrismaClient } from "@prisma/client";
import type { LayoutServerLoad } from "./$types";

const prisma = new PrismaClient();

export const load: LayoutServerLoad = async ({ locals }) => {
  const { user } = locals.auth;
  
  if (!user) return { sessions: [] };

  const sessions = await prisma.session.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" }
  });

  return {
    sessions
  };
};
