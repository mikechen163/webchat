import { PrismaClient } from "@prisma/client";
import type { LayoutServerLoad } from "./$types";
import { error } from "@sveltejs/kit";

const prisma = new PrismaClient();

export const load: LayoutServerLoad = async ({ locals }) => {
  const user = locals.user;
  if (!user) throw error(401, "Unauthorized");

  const sessions = await prisma.session.findMany({
    where: { userId: user.userId },
    orderBy: { createdAt: "desc" }
  });

  return {
    sessions
  };
};
