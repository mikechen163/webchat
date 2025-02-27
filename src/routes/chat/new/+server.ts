import { error, redirect } from "@sveltejs/kit";
import { PrismaClient } from "@prisma/client";
import type { RequestHandler } from "./$types";
//import { cuid } from "cuid";
import { nanoid } from 'nanoid';

// import pkg from 'cuid';
// const { cuid } = pkg;

const prisma = new PrismaClient();

export const GET: RequestHandler = async ({ locals }) => {
  const { user } =  locals.auth;
  if (!user) throw error(401, "Unauthorized");

  const session = await prisma.session.create({
    data: {
      id: nanoid(), // 显式传递一个测试值
      userId: user.id,
      title: "New Chat"
    }
  });

  throw redirect(302, `/chat/${session.id}`);
};
