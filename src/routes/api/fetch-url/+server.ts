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
        //signal: controller.signal,
        // headers: {
        //   'Accept': 'application/json',
        //   'User-Agent': 'WebChatBot/1.0'
        // }
      });

      clearTimeout(timeout);

      if (!response.ok) {
        console.error('[Fetch URL] Jina API error:', response.status);
        throw error(response.status, 'Failed to fetch URL content');
      }

      const data = await response.text();

      console.log('[Fetch URL] Jina API response received');
      
      // Return the raw markdown content directly
      return json({
        url: targetUrl,
        content: data
      });

    } catch (e: any) {
      clearTimeout(timeout);
      if (e.name === 'AbortError') {
        throw error(408, 'Fetch  content error ');
      }
      throw e;
    }

  } catch (e: any) {
    console.error('[Fetch URL] Error:', e);
    throw error(
      e.status || 500,
      e.message || 'Failed to fetch URL content'
    );
  }
};
