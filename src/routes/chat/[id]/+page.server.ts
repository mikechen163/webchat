import { PrismaClient } from "@prisma/client";
import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";

const prisma = new PrismaClient();

export const load: PageServerLoad = async ({ params, locals }) => {
  const { user } = locals.auth;
  if (!user) throw error(401, "Unauthorized");

  // 增加调试日志
  //console.log('Loading session for user:', user);

  const session = await prisma.session.findUnique({
    where: { 
      id: params.id,
      userId: user.id
    },
    include: {
      messages: {
        orderBy: { createdAt: "asc" }
      },
      user: {
        select: {
          language: true,
          // 添加更多用户字段以便调试
          email: true,
          id: true
        }
      }
    }
  });

  if (!session) throw error(404, "Session not found");

  // 调试日志
  console.log('Loaded session with user language:', session.user?.language);

  return {
    session,
    messages: session.messages,
    // 添加时间戳以防止响应被缓存
    timestamp: new Date().toISOString()
  };
};
