import { error } from "@sveltejs/kit";
import { PrismaClient } from "@prisma/client";
import type { PageServerLoad } from "./$types";

const prisma = new PrismaClient();

export const load: PageServerLoad = async ({ locals }) => {
  const { user } =  locals.auth;
  if (!user) throw error(401, "Unauthorized");

  const models = await prisma.modelConfig.findMany({
    orderBy: { name: "asc" }
  });

  return {
    models: models.map(m => ({
      ...m,
      apiKey: "••••••••" // Hide API key in frontend
    })),
    isAdmin: user.role === "admin"
  };
};
