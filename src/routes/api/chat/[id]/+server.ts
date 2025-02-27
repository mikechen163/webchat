import { error, type RequestHandler } from "@sveltejs/kit";
import { PrismaClient } from "@prisma/client";
import { streamResponse } from "$lib/utils/stream";

const prisma = new PrismaClient();
const MAX_HISTORY_MESSAGES = 10;

export const POST: RequestHandler = async ({ request, params, locals }) => {
  const { user } =  locals.auth;
  if (!user) throw error(401, "Unauthorized");

  const { content, systemPrompt } = await request.json();
  if (!content) throw error(400, "Message content is required");

  // 保存用户消息
  await prisma.message.create({
    data: {
      sessionId: params.id,
      role: "user",
      content
    }
  });

  // 获取当前启用的模型配置
  const modelConfig = await prisma.modelConfig.findFirst({
    where: { enabled: true }
  });

  if (!modelConfig) throw error(500, "No enabled model configuration found");

  // 获取历史消息
  const history = await prisma.message.findMany({
    where: { sessionId: params.id },
    orderBy: { createdAt: "desc" },
    take: MAX_HISTORY_MESSAGES,
    select: {
      role: true,
      content: true
    }
  });

  // 创建流式响应
  return streamResponse(
    modelConfig,
    content,
    systemPrompt,
    history.reverse(),
    async (assistantMessage) => {
      await prisma.message.create({
        data: {
          sessionId: params.id,
          role: "assistant",
          content: assistantMessage
        }
      });
    }
  );
};

export const GET: RequestHandler = async ({ params, locals }) => {
  const { user } = await locals.auth.validateUser();
  if (!user) throw error(401, "Unauthorized");

  const messages = await prisma.message.findMany({
    where: { sessionId: params.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      content: true,
      createdAt: true
    }
  });

  return new Response(JSON.stringify(messages), {
    headers: { "Content-Type": "application/json" }
  });
};
