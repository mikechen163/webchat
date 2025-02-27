import { PrismaClient } from "@prisma/client";
import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";

const prisma = new PrismaClient();

export const load: PageServerLoad = async ({ params, locals }) => {
  const { user } =  locals.auth;
  if (!user) throw error(401, "Unauthorized");

  const session = await prisma.session.findUnique({
    where: { 
      id: params.id,
      userId: user.id
    },
    include: {
      messages: {
        orderBy: { createdAt: "asc" }
      }
    }
  });

  if (!session) throw error(404, "Session not found");

  return {
    session,
    messages: session.messages,
    // 添加时间戳以防止响应被缓存
    timestamp: new Date().toISOString()
  };
};
