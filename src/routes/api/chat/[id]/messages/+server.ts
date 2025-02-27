import { error } from "@sveltejs/kit";
import { PrismaClient } from "@prisma/client";
import type { RequestHandler } from "./$types";

const prisma = new PrismaClient();

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const { user } = locals.auth;
  if (!user) throw error(401, "Unauthorized");

  await prisma.message.deleteMany({
    where: {
      sessionId: params.id,
      session: {
        userId: user.id
      }
    }
  });

  return new Response(null, { status: 204 });
};
