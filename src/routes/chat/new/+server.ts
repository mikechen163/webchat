import { error, redirect } from "@sveltejs/kit";
import { PrismaClient } from "@prisma/client";
import type { RequestHandler } from "./$types";

const prisma = new PrismaClient();

export const GET: RequestHandler = async ({ locals }) => {
  const { user } = await locals.auth.validateUser();
  if (!user) throw error(401, "Unauthorized");

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      title: "New Chat"
    }
  });

  throw redirect(302, `/chat/${session.id}`);
};
