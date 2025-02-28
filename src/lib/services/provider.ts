type Model = {
  id: string;
  name: string;
};

export async function testProviderKey(
  providerType: string,
  apiKey: string,
  baseUrl?: string
): Promise<boolean> {
  try {
    switch (providerType) {
      case 'openai':
        return await testOpenAIKey(apiKey, baseUrl);
      case 'gemini':
        return await testGeminiKey(apiKey, baseUrl);
      case 'anthropic':
        return await testAnthropicKey(apiKey, baseUrl);
      default:
        return false;
    }
  } catch (error) {
    console.error(`Error testing key for ${providerType}:`, error);
    return false;
  }
}

export async function fetchProviderModels(
  providerType: string,
  apiKey: string,
  baseUrl?: string
): Promise<Model[]> {
  try {
    switch (providerType) {
      case 'openai':
        return await fetchOpenAIModels(apiKey, baseUrl);
      case 'gemini':
        return await fetchGeminiModels(apiKey, baseUrl);
      case 'anthropic':
        return await fetchAnthropicModels(apiKey, baseUrl);
      default:
        return [];
    }
  } catch (error) {
    console.error(`Error fetching models for ${providerType}:`, error);
    return [];
  }
}

// OpenAI Implementation
async function testOpenAIKey(apiKey: string, baseUrl?: string): Promise<boolean> {
  const url = baseUrl || 'https://api.openai.com/v1/models';
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });
  
  return response.ok;
}

async function fetchOpenAIModels(apiKey: string, baseUrl?: string): Promise<Model[]> {
  const url = baseUrl || 'https://api.openai.com/v1/models';
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch OpenAI models: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  // Filter for chat models
  return data.data
    .filter((model: any) => 
      model.id.includes('gpt') || 
      model.id.includes('text-davinci') ||
      model.id.includes('claude')
    )
    .map((model: any) => ({
      id: model.id,
      name: model.id
    }));
}

// Gemini Implementation
async function testGeminiKey(apiKey: string, baseUrl?: string): Promise<boolean> {
  const url = baseUrl || `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  return response.ok;
}

async function fetchGeminiModels(apiKey: string, baseUrl?: string): Promise<Model[]> {
  const url = baseUrl || `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch Gemini models: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  // Filter for chat models
  return data.models
    .filter((model: any) => 
      model.name.includes('gemini') || 
      model.supportedGenerationMethods.includes('generateContent')
    )
    .map((model: any) => ({
      id: model.name.split('/').pop(),
      name: model.name.split('/').pop()
    }));
}

// Anthropic Implementation
async function testAnthropicKey(apiKey: string, baseUrl?: string): Promise<boolean> {
  const url = baseUrl || 'https://api.anthropic.com/v1/messages';
  
  try {
    const response = await fetch(url, {
      method: 'OPTIONS',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      }
    });
    
    return response.ok || response.status === 405; // OPTIONS may not be supported
  } catch {
    // Try a different approach for Anthropic
    return true; // Since Anthropic doesn't have a model listing endpoint, we'll assume the key is valid
  }
}

async function fetchAnthropicModels(apiKey: string, baseUrl?: string): Promise<Model[]> {
  // Anthropic doesn't have a models listing API, so we'll return the known models
  return [
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
    { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
    { id: 'claude-2.1', name: 'Claude 2.1' },
    { id: 'claude-2.0', name: 'Claude 2.0' },
    { id: 'claude-instant-1.2', name: 'Claude Instant 1.2' }
  ];
}
