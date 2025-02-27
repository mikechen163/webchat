import { json, error } from "@sveltejs/kit";
import { PrismaClient } from "@prisma/client";
import type { RequestHandler } from "./$types";

const prisma = new PrismaClient();

export const POST: RequestHandler = async ({ request, locals }) => {
  const { user } = locals.auth;
  if (!user) throw error(401, "Unauthorized");

  const { title } = await request.json();

  const session = await prisma.session.create({
    data: {
      title,
      userId: user.id
    }
  });

  return json(session);
};
