import { error, redirect } from "@sveltejs/kit";
import { PrismaClient } from "@prisma/client";
import type { RequestHandler } from "./$types";
import { cuid } from "cuid";

const prisma = new PrismaClient();

export const GET: RequestHandler = async ({ locals }) => {
  const { user } =  locals.auth;
  if (!user) throw error(401, "Unauthorized");

  const session = await prisma.session.create({
    data: {
      id: cuid(), // 显式传递一个测试值
      userId: user.id,
      title: "New Chat"
    }
  });

  throw redirect(302, `/chat/${session.id}`);
};
