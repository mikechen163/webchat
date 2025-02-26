import { error } from "@sveltejs/kit";
import type { ModelConfig } from "@prisma/client";

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function streamResponse(
  modelConfig: ModelConfig,
  content: string,
  systemPrompt?: string,
  history: ChatMessage[] = [],
  onComplete: (message: string) => Promise<void>,
  retryCount = 3
) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let attempts = 0;
      
      async function attemptRequest() {
        try {
          const messages: ChatMessage[] = [];
          if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
          }
          messages.push(...history);
          messages.push({ role: 'user', content });

          const response = await fetch(`${modelConfig.baseUrl}/v1/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${modelConfig.apiKey}`
            },
            body: JSON.stringify({
              model: modelConfig.model,
              messages,
              stream: true,
              temperature: 0.7,
              max_tokens: 2000
            })
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            throw error(response.status, errorData?.error?.message || "API request failed");
          }

          const reader = response.body?.getReader();
          if (!reader) throw error(500, "Failed to create stream reader");

          let fullMessage = "";
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += new TextDecoder().decode(value);
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine || trimmedLine === "data: [DONE]") continue;
              
              try {
                const json = JSON.parse(trimmedLine.replace(/^data: /, ""));
                const content = json.choices[0]?.delta?.content || "";
                
                if (content) {
                  fullMessage += content;
                  controller.enqueue(encoder.encode(content));
                }
              } catch (e) {
                console.error("Failed to parse SSE message:", e);
              }
            }
          }

          await onComplete(fullMessage);
        } catch (e) {
          attempts++;
          if (attempts >= retryCount) {
            throw e;
          }
          // 指数退避重试
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
          return attemptRequest();
        }
      }

      try {
        await attemptRequest();
      } catch (e) {
        controller.error(e);
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    }
  });
}

export function createModelClient(modelConfig: ModelConfig) {
  return {
    async validateApiKey(): Promise<boolean> {
      try {
        const response = await fetch(`${modelConfig.baseUrl}/v1/models`, {
          headers: {
            Authorization: `Bearer ${modelConfig.apiKey}`
          }
        });
        return response.ok;
      } catch {
        return false;
      }
    },

    async listModels() {
      const response = await fetch(`${modelConfig.baseUrl}/v1/models`, {
        headers: {
          Authorization: `Bearer ${modelConfig.apiKey}`
        }
      });
      
      if (!response.ok) {
        throw error(response.status, "Failed to fetch models");
      }
      
      return response.json();
    }
  };
}
