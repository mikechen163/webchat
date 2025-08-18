import { error, type RequestHandler } from "@sveltejs/kit";
import { PrismaClient } from "@prisma/client";
import { callMcpProvider } from '$lib/mcp/adapter';
import { streamResponse } from "$lib/utils/stream";
import { json } from '@sveltejs/kit';
import { OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL } from '$env/static/private';

import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';


const prisma = new PrismaClient();
const MAX_HISTORY_MESSAGES = 10;



// 从环境变量读取代理地址（示例：http://user:pass@host:port）
const proxyUrl = process.env.HTTPS_PROXY || 'http://your-proxy-server:8080';
const agent = new HttpsProxyAgent(proxyUrl); // 自动适配 HTTP/HTTPS

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

async function generateTitle(messages: any[], locals: any) {
  // Get the user and their preferences
  const { user } = locals.auth || {};
  let modelConfig;
  
  if (user) {
    try {
      // Get user's default model preference
      const userData = await prisma.user.findUnique({
        where: { id: user.id }
      });
      
      if (userData?.defaultModel) {
        // Find the model configuration for the user's preferred model
        modelConfig = await prisma.modelConfig.findFirst({
          where: { 
            id: userData.defaultModel,
            enabled: true 
          }
        });
      }
    } catch (e) {
      console.log('Could not access user default model, using system default instead');
    }
  }
  
  // If no user preference or model not found, fall back to system default
  if (!modelConfig) {
    modelConfig = await prisma.modelConfig.findFirst({
      where: { enabled: true }
    });
    
    if (!modelConfig) {
      throw new Error('No enabled model configuration found for title generation');
    }
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
${messages.map(m => `${m.role}: ${m.content}`).join('\n')}`;

  const response = await fetch(`${modelConfig.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${modelConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: modelConfig.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.0,
    }),
     agent, // 关键：注入代理配置
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

export async function POST({ request, params, fetch, locals }) {
  try {
  // const { content, modelId, temperature = 0.7, max_tokens,   isSearchAnalysis = false } = await request.json();
    

    // Read effort from the client. allowed values: 'none' | 'low' | 'medium' | 'high'
    // Default to 'none' if not provided or invalid.
    const body = await request.json();
    const {
      content,
      modelId,
      temperature = 0.7,
      max_tokens,
      isSearchAnalysis = false
    } = body || {};

    // Validate and normalize effort
    const ALLOWED_EFFORTS = ['none', 'low', 'medium', 'high'] as const;
    let effort: typeof ALLOWED_EFFORTS[number] = 'none';
    if (body && typeof body.effort === 'string' && ALLOWED_EFFORTS.includes(body.effort as any)) {
      effort = body.effort as typeof ALLOWED_EFFORTS[number];
    } else {
      // if client provided invalid value, log and fallback to 'none'
      if (body && 'effort' in body && body.effort !== undefined) {
        console.warn('Invalid effort value provided, falling back to none:', body.effort);
      }
    }

   // console.log('Effort value set to:', effort);

    // Helper: decide whether this model/provider should receive an effort parameter.
    // Current heuristic:
    // - OpenAI endpoints (api.openai.com) + models starting with 'o3' or 'o4' => supports effort
    // - OpenRouter (or other proxying providers) that expose OpenAI-style models can also be matched by baseUrl contains 'openrouter'
    // Future: replace with explicit modelConfig.supportsEffort boolean in DB or provider adapter capability discovery.
    function supportsEffortForModel(cfg: any): boolean {
      if (!cfg) return false;
      const base = (cfg.baseUrl || '').toLowerCase();
      const modelName = (cfg.model || '').toLowerCase();
      const isOpenAI = base.includes('api.openai.com');
      const isOpenRouter = base.includes('openrouter') || base.includes('api.openrouter.com') || base.includes('openrouter.ai');
      const isO3O4 = modelName.includes('o3') || modelName.includes('o4') || modelName.includes('gpt-5');
      // Add more heuristics if needed
      return (isOpenAI || isOpenRouter) && isO3O4;
    }

    // Map generic effort to provider-specific param. For now we map to 'reasoning_effort' which
    // OpenAI O3/O4 accepts. Returns undefined if effort should be omitted.
    function mapEffortToProviderParam(effortVal: typeof ALLOWED_EFFORTS[number]) {
      if (!effortVal || effortVal === 'none') return undefined;
      // Direct mapping for now; change if provider requires different naming/values.
      // e.g. 'low' -> 'low', 'medium' -> 'medium', 'high' -> 'high'
      return effortVal;
    }


    // 检查是否是系统指令
    const isSystemPrompt = content.startsWith('Analyze these search results for the query') ||
                          content.startsWith('你是一个有帮助的助手，请基于前面提供的搜索') ||
                          content.startsWith('Analyze this query and extract search') ||
                          content.startsWith('Analyze this query and determine the search strategy') ||
                          content.startsWith('You are a helpful assistant. Please summarize and organize the information based on the search');

    // If this is search analysis, try to get user's preferred search model
    const { user } = locals.auth || {};
    let preferredModelId = modelId;
    
    if (user && isSearchAnalysis) {
      try {
        // Get user directly for search model preference
        const userData = await prisma.user.findUnique({
          where: { id: user.id }
        });
        
        // Only use searchModel if it exists in the schema and has a value
        if (userData && 'searchModel' in userData && userData.searchModel) {
          preferredModelId = userData.searchModel;
        }
      } catch (e) {
        // If the field doesn't exist yet, just continue with the provided modelId
        console.log('Could not access searchModel preference, using provided model instead:', e.message);
      }
    }

    // 获取指定的模型配置
    let modelConfig = await prisma.modelConfig.findFirst({
      where: { 
        id: preferredModelId,
        enabled: true 
      },
      include: { provider: true }
    });

    if (!modelConfig) {
      // If no specific model found, try to get user's default model
      let defaultModelId = null;
      
      if (user) {
        try {
          const userData = await prisma.user.findUnique({
            where: { id: user.id }
          });
          
          // Only use defaultModel if it exists in the schema and has a value
          if (userData && 'defaultModel' in userData && userData.defaultModel) {
            defaultModelId = userData.defaultModel;
          }
        } catch (e) {
          // If the field doesn't exist yet, just continue with any enabled model
          console.log('Could not access defaultModel preference, using any enabled model instead:', e.message);
        }
      }
      
      const defaultModel = await prisma.modelConfig.findFirst({
        where: { 
          ...(defaultModelId ? { id: defaultModelId } : {}),
          enabled: true 
        },
        include: { provider: true }
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

    // 如果是分析搜索结果的系统指令，提取用户查询并保存
    if (isSystemPrompt && content.includes('Analyze these search results for the query')) {
      const queryMatch = content.match(/query: \"(.*?)\"/);
      if (queryMatch && queryMatch[1]) {
        const userQuery = queryMatch[1];
        await prisma.message.create({
          data: {
            sessionId: params.id,
            role: "user",
            content: userQuery
          }
        });
      }
    }  

    // 只有非系统指令才保存到数据库
    if (!isSystemPrompt) {
      await prisma.message.create({
        data: {
          sessionId: params.id,
          role: "user",
          content
        }
      });
    }

    // Describe available tools to the model in a strict, machine-readable way.
   const toolDescription = `Available tools:

1) **execute_python**: Executes Python code in a subprocess  
   - Call format: {"tool":"execute_python","code":"<python code>","timeout":5,"cwd":null} 
   - timeout: Maximum execution time in seconds (default: 5)  
   - cwd: Working directory (optional, defaults to repo root)  
   - Returns: JSON object with result string containing stdout, stderr, and return code  

2) **list_dir**: Lists files in a specified directory  
   - Call format: {"tool":"list_dir","path":"."}
   - path: Directory to list (default: current directory)  
   - Returns: Array of file and subdirectory names as strings  

3) **read_file**: Reads the contents of a text file  
   - Call format: {"tool":"read_file","filename":"<filepath>"} or {"path":"<filepath>"}
   - Accepts either filename or path key  
   - Returns: File content as a string, or error message on failure  

4) **save_script**: Saves Python code to a ".py" file in saved_scripts/  
   - Call format: {"tool":"save_script","filename":"myscript","code":"print('Hello')"}  
   - filename: Base name (no path, no .., auto-adds ".py" if missing)  
   - code: Valid Python source to save  
   - Returns: Status message indicating success or error  

5) **exe_script**: Executes a previously saved script from saved_scripts/ 
   - Call format: {"tool":"exe_script","filename":"myscript","timeout":5}  
   - filename: Name of saved script (with or without ".py")  
   - timeout: Optional, default 5 seconds  
   - Returns: Output of the script or error (e.g., timeout, not found)  

6) **autopep8**: Formats a Python script file in-place using autopep8  
   - Call format: {"tool":"autopep8","filename":"saved_scripts/myscript.py"}  
   - filename: Path to the Python script (must be within allowed directory)  
   - Modifies the file directly to conform to PEP 8 style  
   - Returns: Success message or error (e.g., file not found, invalid path)  

7) **install**: Installs a Python package using uv pip install  
   - Call format: {"tool":"install","package":"requests"}  
   - package: Name of the package to install (e.g., "numpy", "requests==2.28.0")  
   - Uses uv for fast, modern package installation  
   - Returns: Status message indicating success or installation error  

---

call execute_python if the code size is less than 800 characters, otherwise use the save_script tool to save the code and then call exe_script to execute it.

#### Example Tool Call (Valid Output Format)
{"tool":"execute_python","code":"print('Hello world!')","timeout":5}`;


    // Prepend the system tool registration so the model is aware of available tools.
    const messages = [{ role: 'system', content: toolDescription }, ...history, { role: 'user', content }];
    let fullAssistantMessage = '';
    let fullReasoningContent = '';
    let reason_content_flag = false;
    let fcontent = '';


    
    
  console.log('Making API request:', {
      command: content.substring(0, 50),
      baseUrl: modelConfig.baseUrl,
      model: modelConfig.model,
      effort: effort,
      temperature,
      ...(max_tokens && { max_tokens })
    });

     let response
    // Check if it's OpenAI base URL and O1/O3 model
    //const isOpenAIUrl = modelConfig.baseUrl.includes('api.openai.com');
    //const isO1O3Model = modelConfig.model.startsWith('o4') || modelConfig.model.startsWith('o3');

        // Decide support for effort and compute mapped parameter
        const isOpenAIUrl = (modelConfig.baseUrl || '').includes('api.openai.com');
        const isO1O3Model = (modelConfig.model || '').includes('o4') || (modelConfig.model || '').includes('o3') || (modelConfig.model || '').includes('gpt-5');
        const modelSupportsEffort = supportsEffortForModel(modelConfig);
        const mappedEffort = mapEffortToProviderParam(effort);
        const isOpenRouterUrl = (modelConfig.baseUrl || '').includes('openrouter');
      

   
    if (modelConfig.provider?.type === 'mcp') {
      // When using MCP providers, include a system/tool registration message so the model knows available tools
      const toolDescription = `TOOLS:\n- execute_python: Executes Python code. Call with JSON: {"tool":"execute_python","code":"<python code>","timeout":<seconds>,"cwd":null}. Return value should be text output.`;
      const mcpMessages = [
        { role: 'system', content: toolDescription },
        ...messages
      ];

      // Call MCP provider via adapter (mocked for tests)
      response = await callMcpProvider(
        modelConfig.provider,
        mcpMessages
      );
    } else if ( isO1O3Model) {
      // Format messages for O1/O3 models
      const formattedMessages = messages.map(msg => ({
        role: msg.role,
        content: [{
          type: 'text',
          text: msg.content
        }]
      }));

      // Special request body for O1/O3 models
      //const requestBody = {

       const requestBody: any = {  
       
        model: modelConfig.model,
        messages: formattedMessages,
        response_format: {
          type: 'text'
        },

      
       // reasoning_effort: 'high',
            // Insert reasoning_effort only when the model/provider supports it and client requested non-none
            ...(modelSupportsEffort && mappedEffort ? { reasoning_effort: mappedEffort } : {}),
          
        stream: true
      };
   

      

     // console.log('Request Body:', requestBody);
       response = await fetch(`${modelConfig.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${modelConfig.apiKey}`,
        },
        body: JSON.stringify(requestBody),
         agent // 关键：注入代理配置
      });
     

  } else {
      // Original request configuration remains for other models
    
     response = await fetch(`${modelConfig.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${modelConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: modelConfig.model,
        messages,
        stream: true,
        temperature,
        ...(max_tokens && { max_tokens }) // Only include max_tokens if it's provided
      }),
       agent // 关键：注入代理配置
    });
  }

  if (!response.ok) {
      console.error('API response error:', response.status, response.statusText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) throw new Error('Stream error');

        try {
          let buffer = '';
          let totalTokens = 0;
          let currentMessage = '';
          
       
          const decoder = new TextDecoder('utf-8'); // 在外层复用
          const encoder = new TextEncoder(); // 如果需要把字符串转为 Uint8Array 再 enqueue

          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
             
              //controller.enqueue(`\ndata: {"tokens": ${totalTokens}}\n\n`);
              // 只有非系统指令且不是JSON响应时才保存assistant消息
              // console.log('Saving assistant message:', fullAssistantMessage);
              
              // Remove <think>...</think> content before saving
              const filteredMessage = fullAssistantMessage.replace(/<think>.*?<\/think>/g, '');

              // Detect a tool call encoded as JSON containing a "tool" field (example: {"tool":"execute_python","code":"..."})
              let finalMessageToSave = filteredMessage;
              try {
                const toolJsonMatch = filteredMessage.match(/\{[\s\S]*?"tool"[\s\S]*?\}/);
                // if (toolJsonMatch) {
                //   try {
                //     const toolCall = JSON.parse(toolJsonMatch[0]);
                //     if (toolCall.tool === 'execute_python' && toolCall.code) {
                //       // Execute the python code via local MCP tool endpoint
                //       const mcpUrl = process.env.LOCAL_MCP_URL || 'http://127.0.0.1:33333';
                //       const execRes = await fetch(`${mcpUrl}/tools/execute_python`, {
                //         method: 'POST',
                //         headers: { 'Content-Type': 'application/json' },
                //         body: JSON.stringify({ code: toolCall.code, timeout: toolCall.timeout || 5, cwd: toolCall.cwd || null })
                //       });
                //       const execData = await execRes.json().catch(() => null);
                //       const execOutput = execData?.result || execData?.error || JSON.stringify(execData);
                //       const toolOutputText = `\n\n[Tool execute_python output]:\n${execOutput}\n`;

                //       // Stream the tool output to the client as continuation
                //       try {
                //         controller.enqueue(toolOutputText);
                //       } catch (e) {
                //         console.error('Failed to enqueue tool output:', e);
                //       }

                //       // Append tool output to message to be saved
                //       finalMessageToSave = filteredMessage + toolOutputText;
                //     }
                //   } catch (e) {
                //     console.error('Failed to parse tool JSON:', e);
                //   }
                // }

             
if (toolJsonMatch) {
  try {
    const toolCall = JSON.parse(toolJsonMatch[0]);
    if (toolCall.tool) {
      // Call local MCP server
      const mcpUrl = process.env.LOCAL_MCP_URL || 'http://127.0.0.1:33333';
      const execRes = await fetch(`${mcpUrl}/tools/${toolCall.tool}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toolCall)
      });

      let toolOutput;
      try {
        const execData = await execRes.json();
        toolOutput = execData.result || execData.items || execData.error || JSON.stringify(execData);
      } catch (e) {
        toolOutput = await execRes.text();
      }

      const toolOutputText = `\n\n[Tool ${toolCall.tool} output]:\n${toolOutput}\n`;

      //console.log(toolOutputText);

      // Stream tool output to client
      try {
        controller.enqueue(toolOutputText);
      } catch (e) {
        console.error('Failed to enqueue tool output:', e);
      }

      // Append tool output to message to be saved
      finalMessageToSave = filteredMessage + toolOutputText;
    }
  } catch (e) {
    console.error('Failed to parse or execute tool call:', e);
  }
}
              } catch (e) {
                console.error('Tool detection error:', e);
              }

              if (!finalMessageToSave.includes('"completeness":') && !finalMessageToSave.includes('"requiresSearch":')) {
                await prisma.message.create({
                  data: {
                    sessionId: params.id,
                    role: "assistant",
                    content: finalMessageToSave
                  }
                });

                // 检查是否需要生成标题
                const messageCount = await prisma.message.count({
                  where: { sessionId: params.id }
                });

                if (messageCount === 2) {
                  fetch(`/api/chat/${params.id}/generate-title`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      temperature: 0.3,
                      max_tokens: 2000
                    })
                  }).catch(console.error);
                }
              }
              break;
            }

              // value 可能是 Uint8Array 或 ArrayBuffer
  const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
  // 流式解码，避免在 chunk 边界处插入替代字符
  buffer += decoder.decode(chunk, { stream: true });

  // 可选：调试每个 chunk 的字节（16 进制）
  // console.log('chunk hex:', Array.from(chunk).map(b => b.toString(16).padStart(2,'0')).join(' '));

  // 以兼容 CRLF/LF 的方式切分行
  const lines = buffer.split(/\r?\n/);


           // buffer += new TextDecoder().decode(value);
           // const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;
              
              if (trimmedLine.startsWith('data: ')) {
                try {
                  const jsonStr = trimmedLine.slice(6);
                  const json = JSON.parse(jsonStr);
                  
                  // 处理不同类型的内容并统计 tokens
                  if (json.choices?.[0]?.delta?.content) {
                    const content = json.choices[0].delta.content;
                    currentMessage += content;
                    fullAssistantMessage += content;
                    controller.enqueue(content);
                  }
                  
                  // 处理推理内容
                  if (json.choices?.[0]?.delta?.reasoning_content || json.choices?.[0]?.delta?.reasoning) {
                    const reasoning = json.choices[0].delta.reasoning_content || json.choices[0].delta.reasoning;
                    
                    const formattedReasoning = reason_content_flag ? reasoning : '<think>' + reasoning;
                    controller.enqueue(formattedReasoning);
                    reason_content_flag = true;
                  } else if (reason_content_flag) {
                    // 结束推理部分
                    reason_content_flag = false;
                    controller.enqueue('</think> <br>');
                  }

                } catch (error) {
                  //console.warn('JSON parse error:', { line: trimmedLine, error });
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
