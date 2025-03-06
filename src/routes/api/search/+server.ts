import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

const SEARCH_SERVICE_URL = env.SEARCH_SERVICE_URL || 'http://127.0.0.1:5100';
const MAX_RETRIES = 1;
const RETRY_DELAY = 1000;

async function fetchWithRetry(url: string, options: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  try {
    const response = await fetch(url, {
      ...options,
      // 添加额外的fetch选项以处理Node.js环境
      headers: {
        ...options.headers,
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response;
  } catch (err) {
    console.error(`[Search API] Attempt failed:`, err);
    
    if (retries > 0) {
      console.log(`[Search API] Retrying... ${retries} attempts remaining`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return fetchWithRetry(url, options, retries - 1);
    }
    
    throw err;
  }
}

export const GET: RequestHandler = async ({ url, fetch }) => {
  const query = url.searchParams.get('q');
  
  if (!query) {
    throw error(400, 'Query parameter is required');
  }

  console.log('[Search API] Received search request:', { query });

  try {
    const searchUrl = `${SEARCH_SERVICE_URL}/?q=${encodeURIComponent(query)}`;
    console.log('[Search API] Calling search service:', { url: searchUrl });

    const response = await fetchWithRetry(searchUrl, {
      headers: {
        'Accept': 'application/json'
      }
    });

    console.log('[Search API] Search service response status:', response.status);

    const data = await response.json();
    console.log('[Search API] Search results:', {
      query,
      resultsCount: data.results?.length || 0,
      timestamp: data.timestamp
    });

    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
      }
    });
  } catch (e) {
    console.error('[Search API] Search error:', e);
    
    // 提供更具体的错误信息
    const errorMessage = e instanceof Error 
      ? `Search service error: ${e.message}`
      : 'Unknown search service error';
      
    throw error(502, {
      message: errorMessage,
      code: 'SEARCH_SERVICE_ERROR'
    });
  }
};
