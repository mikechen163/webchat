import { error, type RequestHandler } from "@sveltejs/kit";
import { PrismaClient } from "@prisma/client";
import { callMcpProvider, callMcpTool } from '$lib/mcp/adapter';
import { streamResponse } from "$lib/utils/stream";
import { json } from '@sveltejs/kit';
import { OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL } from '$env/static/private';

import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { t } from "$lib/stores/i18n.js";


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

// Type for MCP server with tools
interface McpServerWithTools {
  id: string;
  name: string;
  baseUrl: string;
  command: string | null;
  args: string | null;
  transport: string;
  apiKey: string | null;
  tools: Array<{ name: string; description: string; inputSchema?: any }>;
}

// Build dynamic tool descriptions from user's enabled MCP servers
async function buildDynamicToolDescription(userId: string | undefined): Promise<{
  description: string;
  mcpToolMap: Map<string, McpServerWithTools>;
}> {
  // Map tool names to their MCP server config
  const mcpToolMap = new Map<string, McpServerWithTools>();

  // Base prompt header
  const header = `Available tools (call by outputting a JSON object with "tool" field):`;

  // If no user, return empty tools
  if (!userId) {
    return {
      description: header + `\n\nNo MCP tools configured. Please enable MCP servers in settings.\n\n#### Example Tool Call Format\n{"tool":"<tool_name>","param1":"value1","param2":"value2"}`,
      mcpToolMap
    };
  }

  try {
    // Get user's enabled MCP servers with their tools
    const userMcpServers = await prisma.userMcpServer.findMany({
      where: {
        userId: userId,
        enabled: true
      },
      include: {
        mcpServer: true
      }
    });

    if (userMcpServers.length === 0) {
      return {
        description: header + `\n\nNo MCP tools configured. Please enable MCP servers in settings.\n\n#### Example Tool Call Format\n{"tool":"<tool_name>","param1":"value1","param2":"value2"}`,
        mcpToolMap
      };
    }

    // Build tool descriptions from MCP servers
    let toolIndex = 1;
    let toolDescriptions = '';

    for (const userMcp of userMcpServers) {
      const server = userMcp.mcpServer;
      if (!server.enabled) continue;

      const tools = server.tools ? JSON.parse(server.tools) : [];
      if (tools.length === 0) continue;

      toolDescriptions += `\n\n### From ${server.name}:\n`;

      for (const tool of tools) {
        // Add to the tool map for routing
        mcpToolMap.set(tool.name, {
          id: server.id,
          name: server.name,
          baseUrl: server.baseUrl,
          command: server.command,
          args: server.args,
          transport: server.transport,
          apiKey: server.apiKey,
          tools: tools
        });

        toolDescriptions += `\n${toolIndex}) **${tool.name}**: ${tool.description || 'No description'}\n`;
        toolDescriptions += `   - Call format: {"tool":"${tool.name}"`;

        // Add input schema properties if available
        if (tool.inputSchema?.properties) {
          const props = Object.entries(tool.inputSchema.properties);
          for (const [propName] of props) {
            toolDescriptions += `,"${propName}":"<value>"`;
          }
        }
        toolDescriptions += '}\n';

        toolIndex++;
      }
    }

    // Generate example from first available tool
    const firstTool = mcpToolMap.size > 0 ? Array.from(mcpToolMap.keys())[0] : 'tool_name';
    const exampleFormat = `\n---\n\n#### Example Tool Call (Valid Output Format)\n{"tool":"${firstTool}",...}`;

    const fullDescription = header + toolDescriptions + exampleFormat;

    return { description: fullDescription, mcpToolMap };
  } catch (e) {
    console.error('Error building dynamic tool description:', e);
    return {
      description: header + `\n\nError loading MCP tools. Please check server configuration.`,
      mcpToolMap
    };
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

    // Build dynamic tool description including user's enabled MCP servers
    const { description: toolDescription, mcpToolMap } = await buildDynamicToolDescription(user?.id);

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
    } else if (isO1O3Model) {
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

    const MAX_TOOL_ITERATIONS = 10;

    // Helper function to make LLM API call
    async function makeLLMRequest(msgs: any[]) {
      if (modelConfig.provider?.type === 'mcp') {
        const mcpToolDesc = `TOOLS:\n- execute_python: Executes Python code. Call with JSON: {"tool":"execute_python","code":"<python code>","timeout":<seconds>,"cwd":null}. Return value should be text output.`;
        const mcpMessages = [{ role: 'system', content: mcpToolDesc }, ...msgs];
        return await callMcpProvider(modelConfig.provider, mcpMessages);
      } else if (isO1O3Model) {
        const formattedMessages = msgs.map(msg => ({
          role: msg.role,
          content: [{ type: 'text', text: msg.content }]
        }));
        const requestBody: any = {
          model: modelConfig.model,
          messages: formattedMessages,
          response_format: { type: 'text' },
          ...(modelSupportsEffort && mappedEffort ? { reasoning_effort: mappedEffort } : {}),
          stream: true
        };
        return await fetch(`${modelConfig.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${modelConfig.apiKey}`,
          },
          body: JSON.stringify(requestBody),
          agent
        });
      } else {
        return await fetch(`${modelConfig.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${modelConfig.apiKey}`,
          },
          body: JSON.stringify({
            model: modelConfig.model,
            messages: msgs,
            stream: true,
            temperature,
            ...(max_tokens && { max_tokens })
          }),
          agent
        });
      }
    }

    // Helper function to execute a tool call
    async function executeToolCall(toolCall: any): Promise<string> {
      let toolOutput: string;

      // Check if tool is from a registered MCP server
      const mcpServer = mcpToolMap.get(toolCall.tool);

      if (mcpServer) {
        // Route to third-party MCP server via adapter
        const result = await callMcpTool(
          {
            id: mcpServer.id,
            name: mcpServer.name,
            baseUrl: mcpServer.baseUrl,
            command: mcpServer.command,
            args: mcpServer.args,
            apiKey: mcpServer.apiKey,
            transport: mcpServer.transport as 'http' | 'ws' | 'stdio'
          },
          toolCall.tool,
          toolCall
        );

        if (result.success) {
          toolOutput = typeof result.result === 'string'
            ? result.result
            : JSON.stringify(result.result);
        } else {
          toolOutput = `Error: ${result.error}`;
        }
      } else {
        // Fallback: try local MCP server (for backward compatibility)
        const mcpUrl = process.env.LOCAL_MCP_URL || 'http://127.0.0.1:33333';
        try {
          const execRes = await fetch(`${mcpUrl}/tools/${toolCall.tool}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(toolCall)
          });

          const execData = await execRes.json() as any;
          toolOutput = execData.result || execData.items || execData.error || JSON.stringify(execData);
        } catch (e) {
          toolOutput = `Error: Tool "${toolCall.tool}" not found in any registered MCP server and local fallback failed: ${(e as Error).message}`;
        }
      }

      return toolOutput;
    }

    // Helper function to sanitize tool arguments based on schema
    function sanitizeToolArgs(toolCall: any): any {
      const serverConfig = mcpToolMap.get(toolCall.tool);
      if (serverConfig) {
        const toolDef = serverConfig.tools.find(t => t.name === toolCall.tool);
        if (toolDef?.inputSchema?.properties) {
          for (const [key, value] of Object.entries(toolCall)) {
            if (key === 'tool') continue;
            const propSchema = toolDef.inputSchema.properties[key];
            if (!propSchema) continue;

            if (typeof value === 'string') {
              if (propSchema.type === 'boolean') {
                if ((value as string).toLowerCase() === 'true') toolCall[key] = true;
                if ((value as string).toLowerCase() === 'false') toolCall[key] = false;
              } else if (propSchema.type === 'integer' || propSchema.type === 'number') {
                const num = Number(value);
                if (!isNaN(num)) {
                  toolCall[key] = num;
                } else {
                  delete toolCall[key];
                }
              }
            }

            if ((propSchema.type === 'integer' || propSchema.type === 'number') && (toolCall[key] === 0 || toolCall[key] === '')) {
              delete toolCall[key];
            }
          }
        }
      }
      return toolCall;
    }

    if (!response.ok) {
      console.error('API response error:', response.status, response.statusText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const stream = new ReadableStream({
      async start(controller) {
        const decoder = new TextDecoder('utf-8');
        const encoder = new TextEncoder();

        // Working copy of messages for the agentic loop
        let loopMessages = [...messages];
        let allAssistantContent = ''; // Accumulates ALL content across iterations for saving

        try {
          // === AGENTIC TOOL LOOP ===
          for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
            console.log(`[Agentic Loop] Iteration ${iteration + 1}/${MAX_TOOL_ITERATIONS}`);

            // Make LLM request (use initial response for first iteration)
            let currentResponse = iteration === 0 ? response : await makeLLMRequest(loopMessages);

            if (iteration > 0 && !currentResponse.ok) {
              console.error(`[Agentic Loop] LLM request failed at iteration ${iteration + 1}`);
              controller.enqueue(encoder.encode(`\n\n[Error: LLM request failed at iteration ${iteration + 1}]\n`));
              break;
            }

            const reader = currentResponse.body?.getReader();
            if (!reader) {
              console.error('[Agentic Loop] No response body reader');
              break;
            }

            let buffer = '';
            let iterationAssistantMessage = '';
            let reason_content_flag_loop = false;

            // Read the stream for this iteration
            while (true) {
              const { done, value } = await reader.read();

              if (done) {
                // Stream finished for this iteration
                break;
              }

              const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
              buffer += decoder.decode(chunk, { stream: true });
              const lines = buffer.split(/\r?\n/);
              buffer = lines.pop() || '';

              for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;

                if (trimmedLine.startsWith('data: ')) {
                  try {
                    const jsonStr = trimmedLine.slice(6);
                    const json = JSON.parse(jsonStr);

                    if (json.choices?.[0]?.delta?.content) {
                      const content = json.choices[0].delta.content;
                      iterationAssistantMessage += content;
                      controller.enqueue(content);
                    }

                    if (json.choices?.[0]?.delta?.reasoning_content || json.choices?.[0]?.delta?.reasoning) {
                      const reasoning = json.choices[0].delta.reasoning_content || json.choices[0].delta.reasoning;
                      const formattedReasoning = reason_content_flag_loop ? reasoning : '<think>' + reasoning;
                      controller.enqueue(formattedReasoning);
                      reason_content_flag_loop = true;
                    } else if (reason_content_flag_loop) {
                      reason_content_flag_loop = false;
                      controller.enqueue('</think> <br>');
                    }
                  } catch (error) {
                    continue;
                  }
                }
              }
            }

            // Accumulate content
            allAssistantContent += iterationAssistantMessage;

            // Check for tool call in this iteration's response
            const filteredMessage = iterationAssistantMessage.replace(/<think>.*?<\/think>/g, '');
            const toolJsonMatch = filteredMessage.match(/\{[\s\S]*?"tool"[\s\S]*?\}/);

            if (toolJsonMatch) {
              try {
                let toolCall = JSON.parse(filteredMessage);

                if (toolCall.tool) {
                  console.log(`[Agentic Loop] Tool call detected: ${toolCall.tool}`);

                  // Sanitize arguments
                  toolCall = sanitizeToolArgs(toolCall);

                  // Execute the tool
                  const toolOutput = await executeToolCall(toolCall);
                  const toolOutputText = `\n\n[Tool ${toolCall.tool} output]:\n${toolOutput}\n`;

                  // Stream tool output to client
                  controller.enqueue(encoder.encode(toolOutputText));
                  allAssistantContent += toolOutputText;

                  // Append to loop messages for next iteration
                  // Add assistant's tool call message
                  loopMessages.push({
                    role: 'assistant',
                    content: iterationAssistantMessage
                  });

                  // Add tool result as a user message (or tool role if supported)
                  loopMessages.push({
                    role: 'user',
                    content: `[Tool Result for ${toolCall.tool}]:\n${toolOutput}`
                  });

                  // Continue to next iteration
                  continue;
                }
              } catch (e) {
                console.error('[Agentic Loop] Failed to parse tool call:', e);
              }
            }

            // No tool call detected - this is the final response
            console.log(`[Agentic Loop] No tool call detected, ending loop at iteration ${iteration + 1}`);
            break;
          }

          // Save the complete assistant message
          if (!allAssistantContent.includes('"completeness":') && !allAssistantContent.includes('"requiresSearch":')) {
            await prisma.message.create({
              data: {
                sessionId: params.id,
                role: "assistant",
                content: allAssistantContent
              }
            });

            const messageCount = await prisma.message.count({
              where: { sessionId: params.id }
            });

            if (messageCount === 2) {
              fetch(`/api/chat/${params.id}/generate-title`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ temperature: 0.3, max_tokens: 2000 })
              }).catch(console.error);
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
