import { error, type RequestHandler } from "@sveltejs/kit";
import { PrismaClient } from "@prisma/client";
import { streamResponse } from "$lib/utils/stream";
import { json } from '@sveltejs/kit';
import { OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL } from '$env/static/private';

const prisma = new PrismaClient();
const MAX_HISTORY_MESSAGES = 10;

// export const POST: RequestHandler = async ({ request, params, locals }) => {
//   const { user } =  locals.auth;
//   if (!user) throw error(401, "Unauthorized");

//   const { content, systemPrompt } = await request.json();
//   if (!content) throw error(400, "Message content is required");

//   // 保存用户消息
//   await prisma.message.create({
//     data: {
//       sessionId: params.id,
//       role: "user",
//       content
//     }
//   });

//   // 获取当前启用的模型配置
//   const modelConfig = await prisma.modelConfig.findFirst({
//     where: { enabled: true }
//   });

//   if (!modelConfig) throw error(500, "No enabled model configuration found");

//   // 获取历史消息
//   const history = await prisma.message.findMany({
//     where: { sessionId: params.id },
//     orderBy: { createdAt: "desc" },
//     take: MAX_HISTORY_MESSAGES,
//     select: {
//       role: true,
//       content: true
//     }
//   });

//   // 创建流式响应
//   return streamResponse(
//     modelConfig,
//     content,
//     systemPrompt,
//     history.reverse(),
//     async (assistantMessage) => {
//       await prisma.message.create({
//         data: {
//           sessionId: params.id,
//           role: "assistant",
//           content: assistantMessage
//         }
//       });
//     }
//   );
// };

export async function POST({ request, params }) {
  try {
    const { content } = await request.json();
    
    if (!OPENAI_BASE_URL || !OPENAI_API_KEY) {
      throw new Error('Missing OpenAI configuration');
    }

    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [{ role: 'user', content }],
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    return new Response(
      new ReadableStream({
        async start(controller) {
          const reader = response.body?.getReader();
          if (!reader) throw new Error('Stream error');

          try {
            let buffer = '';
            
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              // 将新数据添加到缓冲区
              buffer += new TextDecoder().decode(value);
              
              // 处理缓冲区中的完整行
              const lines = buffer.split('\n');
              buffer = lines.pop() || ''; // 保留最后一个不完整的行

              for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;
                
                if (trimmedLine.startsWith('data: ')) {
                  try {
                    const jsonStr = trimmedLine.slice(6); // 移除 'data: '
                    const json = JSON.parse(jsonStr);
                    const content = json.choices?.[0]?.delta?.content || '';
                    if (content) {
                      controller.enqueue(content);
                    }
                  } catch (error) {
                    console.warn('JSON parse error:', { line: trimmedLine, error });
                    continue;
                  }
                }
              }
            }
            
            controller.close();
          } catch (e) {
            console.error('Stream processing error:', e);
            controller.error(e);
          }
        }
      }),
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        }
      }
    );
  } catch (e) {
    console.error('Chat API error:', e);
    throw error(500, 'Internal server error');
  }
}

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
