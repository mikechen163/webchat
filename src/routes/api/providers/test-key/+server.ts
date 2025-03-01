import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { testProviderKey, fetchProviderModels } from '$lib/services/provider';

// Sanitize input data
function sanitizeInput(data: any) {
  return {
    type: typeof data.type === 'string' ? data.type.trim() : '',
    apiKey: typeof data.apiKey === 'string' ? 
      data.apiKey.replace(/TypeError:.*|Error:.*$/g, '').trim() : '',
    baseUrl: typeof data.baseUrl === 'string' ? data.baseUrl.trim() : ''
  };
}

export const POST = (async ({ request }) => {
  try {
    const rawData = await request.json();
    const { type, apiKey, baseUrl } = sanitizeInput(rawData);
    
    console.log(`Testing ${type} API key (sanitized)`);
    
    if (!type || !apiKey) {
      return json({ 
        success: false, 
        message: 'Provider type and API key are required' 
      }, { status: 400 });
    }
    
    // Test the API key
    const isValid = await testProviderKey(type, apiKey, baseUrl);
    
    if (!isValid) {
      return json({ 
        success: false, 
        message: 'Invalid API key or connection failed' 
      });
    }
    
    // If valid, fetch available models
    const models = await fetchProviderModels(type, apiKey, baseUrl);
    
    return json({
      success: true,
      models
    });
    
  } catch (e) {
    console.error('Error testing API key:', e);
    return json({ 
      success: false, 
      message: e instanceof Error ? e.message : 'Failed to validate API key'
    }, { status: 200 }); // Return 200 even for errors to handle in UI
  }
}) satisfies RequestHandler;
