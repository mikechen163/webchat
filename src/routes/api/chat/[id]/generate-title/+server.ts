import { error } from "@sveltejs/kit";
import { PrismaClient } from "@prisma/client";
import { OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL } from '$env/static/private';
import type { RequestHandler } from "./$types";

const prisma = new PrismaClient();

export const POST: RequestHandler = async ({ params }) => {
  try {
    // 获取最近的消息对
    const messages = await prisma.message.findMany({
      where: { sessionId: params.id },
      orderBy: { createdAt: 'desc' },
      take: 2,
      select: {
        role: true,
        content: true
      }
    });

    if (messages.length < 2) {
      throw error(400, "Not enough messages for title generation");
    }

    const prompt = `### Task:
Generate a concise, 3-5 word title with an emoji summarizing the chat history.
### Guidelines:
- The title should clearly represent the main theme or subject of the conversation.
- Use emojis that enhance understanding of the topic, but avoid quotation marks or special formatting.
- Write the title in the chat's primary language; default to English if multilingual.
- Prioritize accuracy over excessive creativity; keep it clear and simple.
### Output:
JSON format: { "title": "your concise title here" }
### Chat History:
${messages.reverse().map(m => `${m.role}: ${m.content}`).join('\n')}`;

    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate title');
    }

    const data = await response.json();
    const titleResponse = JSON.parse(data.choices[0].message.content);

    if (titleResponse?.title) {
      await prisma.session.update({
        where: { id: params.id },
        data: { title: titleResponse.title }
      });
    }

    return new Response(JSON.stringify({ title: titleResponse.title }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    console.error('Title generation error:', e);
    throw error(500, 'Failed to generate title');
  }
};
