import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

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

      console.log('[Fetch URL] Jina API response:', data.count);
      
      // Return a simplified response with markdown content
      return json({
        url: targetUrl,
        //timestamp: new Date().toISOString(),
        text: data,  // Prefer markdown if available
        
      });

    } catch (e) {
      clearTimeout(timeout);
      if (e.name === 'AbortError') {
        throw error(408, 'Request timeout');
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
