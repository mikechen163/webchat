import { error } from "@sveltejs/kit";
import { PrismaClient } from "@prisma/client";
import type { RequestHandler } from "./$types";

const prisma = new PrismaClient();

export const GET: RequestHandler = async ({ params }) => {
  const session = await prisma.session.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      createdAt: true
    }
  });

  if (!session) {
    throw error(404, "Session not found");
  }

  return new Response(JSON.stringify(session), {
    headers: { "Content-Type": "application/json" }
  });
};
