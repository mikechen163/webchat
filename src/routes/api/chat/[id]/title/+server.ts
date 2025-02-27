import { error } from "@sveltejs/kit";
import { PrismaClient } from "@prisma/client";
import type { RequestHandler } from "./$types";

const prisma = new PrismaClient();

export const PATCH: RequestHandler = async ({ params, request }) => {
  const { title } = await request.json();
  
  if (!title?.trim()) {
    throw error(400, "Title is required");
  }

  try {
    await prisma.session.update({
      where: { id: params.id },
      data: { title }
    });

    return new Response(null, { status: 204 });
  } catch (e) {
    console.error('Title update error:', e);
    throw error(500, 'Failed to update title');
  }
};
