import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper function to validate URL
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

export const GET: RequestHandler = async ({ url, fetch }) => {
  try {
    const targetUrl = url.searchParams.get('url');
    
    if (!targetUrl) {
      throw error(400, 'URL parameter is required');
    }

    if (!isValidUrl(targetUrl)) {
      throw error(400, 'Invalid URL provided');
    }

    // Use Jina's readability service with markdown format
    const jinaUrl = `https://r.jina.ai/${encodeURIComponent(targetUrl)}?format=markdown`;
    
    console.log('[Fetch URL] Fetching markdown from:', jinaUrl);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(jinaUrl, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'WebChatBot/1.0'
        }
      });

      clearTimeout(timeout);

      if (!response.ok) {
        console.error('[Fetch URL] Jina API error:', response.status);
        throw error(response.status, 'Failed to fetch URL content');
      }

      const data = await response.json();

      console.log('[Fetch URL] Jina API response:', data.data.description);
      if (typeof data.data.content === 'string' && typeof data.data.description === 'string' && data.data.content.length > 200)  {
        // const secondOccurrence = data.data.content.indexOf(data.data.description, data.data.content.indexOf(data.data.description) + 1);
        // if (secondOccurrence !== -1) {
        //   data.data.content = data.data.content.substring(secondOccurrence);
        // }
       
        // Get model config from environment and database
        const filterModel = process.env.FILTER_MODEL;
        if (!filterModel) {
          throw error(500, 'FILTER_MODEL not configured');
        }

        // Fetch model config from database using Prisma
        const modelConfig = await prisma.modelConfig.findFirst({
          where: {
            name: filterModel,
            enabled: true
          }
        });

        //console.log('[Fetch URL] Model config:', modelConfig);

        if (!modelConfig) {
          throw error(500, 'Model configuration not found');
        }
        // Call the AI model endpoint with proper path
        const response = await fetch(`${modelConfig.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${modelConfig.apiKey}`
          },
          body: JSON.stringify({
            model: modelConfig.model,
            messages: [
              {
                role: "system", 
                content: `You are a web content filtering expert. Please extract the main information from the original content and remove the following:
                  1. Advertising content
                  2. Navigation links  
                  3. Copyright statements
                  4. Social media buttons
                  5. Website menus
                  6. User comments
                  7. Pop-up notifications
                  8. Recommended reading
                  Only retain the core content related to the topic.`
              },
              {
                role: "user",
                content: `Please filter the following webpage content:\n\n${data.data.content}`
              }
            ],
            temperature: 0.0,
            max_tokens: 4000
          })
        });
       
      

        //console.log('[Fetch URL] Filter model response:', response);
        if (!response.ok) {
          throw error(response.status, 'Filter model request failed');
        }
        const filterResponse = await response.json();
        data.data.content = filterResponse.choices[0].message.content;
        //console.log('[Fetch URL] Filter model response:', data.data.content);

      }

      //console.log('[Fetch URL] Jina API response:', data.data.content);
         // Return a simplified response with markdown content
      return json({
        url: targetUrl,
        //timestamp: new Date().toISOString(),
        text: data,  // Prefer markdown if available
        
      });

    } catch (e) {
      clearTimeout(timeout);
      if (e.name === 'AbortError') {
        throw error(408, 'Fetch  content error ');
      }
      throw e;
    }

  } catch (e) {
    console.error('[Fetch URL] Error:', e);
    throw error(
      e.status || 500,
      e.message || 'Failed to fetch URL content'
    );
  }
};
