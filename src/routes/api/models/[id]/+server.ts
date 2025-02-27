import { error, json } from "@sveltejs/kit";
import { PrismaClient } from "@prisma/client";
import type { RequestHandler } from "./$types";

const prisma = new PrismaClient();

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const { user } = locals.auth;
  if (!user || user.role !== "admin") {
    throw error(403, "Unauthorized");
  }

  const { enabled } = await request.json();
  
  const updatedModel = await prisma.modelConfig.update({
    where: { id: params.id },
    data: { enabled }
  });

  return json({ ...updatedModel, apiKey: "••••••••" });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const { user } = locals.auth;
  if (!user || user.role !== "admin") {
    throw error(403, "Unauthorized");
  }

  await prisma.modelConfig.delete({
    where: { id: params.id }
  });

  return new Response(null, { status: 204 });
};
