import { error } from "@sveltejs/kit";
import { PrismaClient } from "@prisma/client";
import type { RequestHandler } from "./$types";

const prisma = new PrismaClient();

export const POST: RequestHandler = async ({ params }) => {
  try {
    // Get chat messages, user's language preference and selected model config
    const session = await prisma.session.findUnique({
      where: { id: params.id },
      include: {
        user: true,
        messages: {
          orderBy: { createdAt: 'asc' },
          select: { role: true, content: true }
        }
      }
    });

    //console.log('Generate title , Session:', session);

    if (!session || session.messages.length === 0) {
      return new Response(null, { status: 204 });
    }

    // Get current active model config
    const modelConfig = await prisma.modelConfig.findFirst({
      where: { enabled: true },
      include: { provider: true }
    });

    if (!modelConfig) {
      throw new Error('No active model configuration found');
    }

    // Generate title using the selected model
    const promptByLang = {
      en: 'Generate a concise, 3-5 word title with an emoji summarizing this chat:',
      zh: '为这个对话生成一个简洁的3-5个字的中文标题，包含emoji表情：'
    };

    const prompt = `${promptByLang[session.user.language] || promptByLang.en}
${session.messages.map(m => `${m.role}: ${m.content}`).join('\n')}

Response format: { "title": "emoji title here" }`;

    const response = await fetch(`${modelConfig.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${modelConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: modelConfig.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: modelConfig.temperature,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate title');
    }

    const data = await response.json();
    try {
      const { title } = JSON.parse(data.choices[0].message.content);
      
      // Update session title
      await prisma.session.update({
        where: { id: params.id },
        data: { title }
      });

      return new Response(null, { status: 204 });
    } catch (e) {
      console.error('Failed to parse title response:', e);
      return new Response(null, { status: 204 });
    }
  } catch (e) {
    console.error('Title generation error:', e);
    throw error(500, 'Failed to generate title');
  }
};
