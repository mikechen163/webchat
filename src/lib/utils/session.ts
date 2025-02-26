import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function generateSessionTitle(sessionId: string): Promise<string> {
  const firstMessage = await prisma.message.findFirst({
    where: { sessionId },
    orderBy: { createdAt: "asc" }
  });

  if (!firstMessage) return "New Chat";

  // 使用第一条用户消息的前30个字符作为标题
  const title = firstMessage.content
    .slice(0, 30)
    .replace(/\n/g, " ")
    .trim();

  return title + (firstMessage.content.length > 30 ? "..." : "");
}

export async function cleanupOldSessions(userId: string, maxSessions = 50) {
  const sessions = await prisma.session.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
    skip: maxSessions
  });

  if (sessions.length > 0) {
    await prisma.session.deleteMany({
      where: {
        id: {
          in: sessions.map(s => s.id)
        }
      }
    });
  }
}
