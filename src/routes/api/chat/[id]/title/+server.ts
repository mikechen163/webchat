import { error, json } from "@sveltejs/kit";
import { PrismaClient } from "@prisma/client";
import type { RequestHandler } from "./$types";

const prisma = new PrismaClient();

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const { user } =  locals.auth;
  if (!user) throw error(401, "Unauthorized");

  const { title } = await request.json();
  if (!title) throw error(400, "Title is required");

  const session = await prisma.session.update({
    where: {
      id: params.id,
      userId: user.id
    },
    data: { title }
  });

  return json(session);
};
