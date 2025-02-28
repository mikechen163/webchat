import { json } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { testProviderKey, fetchProviderModels } from '$lib/services/provider';
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request, locals }) => {
  // Verify admin access
  const { user } = locals.auth;
  if (!user || user.role !== "admin") {
    throw error(403, "Unauthorized");
  }

  try {
    const { providerType, apiKey, baseUrl } = await request.json();
    
    if (!providerType || !apiKey) {
      throw error(400, 'Provider type and API key are required');
    }
    
    // Test the API key
    const isValid = await testProviderKey(providerType, apiKey, baseUrl);
    
    if (!isValid) {
      return json({ 
        success: false, 
        message: 'Invalid API key or connection failed' 
      });
    }
    
    // If valid, fetch available models
    const models = await fetchProviderModels(providerType, apiKey, baseUrl);
    
    return json({
      success: true,
      models
    });
    
  } catch (e) {
    console.error('Error testing API key:', e);
    return json({ 
      success: false, 
      message: e.message || 'Failed to validate API key'
    }, { status: 200 }); // Return 200 even for errors to handle in UI
  }
};
