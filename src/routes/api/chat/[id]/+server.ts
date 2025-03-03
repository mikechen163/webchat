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

export function OPTIONS() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    }
  });
}

async function generateTitle(messages: any[]) {
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
${messages.map(m => `${m.role}: ${m.content}`).join('\n')}`;

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
  try {
    return JSON.parse(data.choices[0].message.content);
  } catch (e) {
    console.error('Failed to parse title response:', e);
    return null;
  }
}

export async function POST({ request, params, fetch }) {  // Add fetch to destructured params
  try {
    const { content, modelId } = await request.json();
    //console.log('Received request:', { content, modelId });
    
    // 获取指定的模型配置
    let modelConfig = await prisma.modelConfig.findFirst({
      where: { 
        id: modelId,
        enabled: true 
      }
    });

    
    if (!modelConfig) {
      // If no specific model found, try to get default model
      const defaultModel = await prisma.modelConfig.findFirst({
        where: { enabled: true }
      });
      
      console.log('Falling back to default model:', defaultModel);
      
      if (!defaultModel) {
        throw error(400, "No valid model configuration found");
      }
      
      modelConfig = defaultModel;
    }

    

    // 获取历史消息并保存用户消息
    const history = await prisma.message.findMany({
      where: { sessionId: params.id },
      orderBy: { createdAt: 'asc' },
      take: MAX_HISTORY_MESSAGES,
      select: { role: true, content: true }
    });

    await prisma.message.create({
      data: {
        sessionId: params.id,
        role: "user",
        content
      }
    });

    const messages = [...history, { role: 'user', content }];
    let fullAssistantMessage = '';
    
    console.log('baseurl=', modelConfig.baseUrl, 'model=', modelConfig.model);
     const response = await fetch(`${modelConfig.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${modelConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: modelConfig.model,
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) throw new Error('Stream error');

        try {
          let buffer = '';
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              // 在流结束时保存消息和生成标题
              await prisma.message.create({
                data: {
                  sessionId: params.id,
                  role: "assistant",
                  content: fullAssistantMessage
                }
              });

              // 检查是否需要生成标题
              const messageCount = await prisma.message.count({
                where: { sessionId: params.id }
              });

              if (messageCount === 2) {
                // Use the provided fetch instead of global fetch
                fetch(`/api/chat/${params.id}/generate-title`, {
                  method: 'POST'
                }).catch(console.error);
              }
              
              break;
            }

            buffer += new TextDecoder().decode(value);
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;
              
              if (trimmedLine.startsWith('data: ')) {
                try {
                  const jsonStr = trimmedLine.slice(6);
                  const json = JSON.parse(jsonStr);
                  const content = json.choices?.[0]?.delta?.content || '';
                  if (content) {
                    fullAssistantMessage += content;
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
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    });

  } catch (e) {
    console.error('Chat API error:', e);
    throw error(500, 'Internal server error');
  }
}

export const GET = async ({ params, locals }) => {
  try {
    // Get session data
    const session = await prisma.session.findUnique({
      where: { id: params.id }
    });
    
    if (!session) {
      throw error(404, "Session not found");
    }
    
    // Get messages
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
    
    // Return both session and messages
    return json({
      session,
      messages
    });
  } catch (e) {
    console.error('Error fetching chat:', e);
    throw error(500, 'Failed to fetch chat data');
  }
};

export const DELETE: RequestHandler = async ({ params }) => {
  try {
    // 删除会话相关的所有消息
    await prisma.message.deleteMany({
      where: { sessionId: params.id }
    });

    // 删除会话
    await prisma.session.delete({
      where: { id: params.id }
    });

    return new Response(null, { status: 204 });
  } catch (e) {
    console.error('Session deletion error:', e);
    throw error(500, 'Failed to delete session');
  }
};
