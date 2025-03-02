import { json } from '@sveltejs/kit';
import { PrismaClient } from '@prisma/client';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const prisma = new PrismaClient();

// GET /api/providers - List all providers
export const GET: RequestHandler = async () => {
  try {
    const providers = await prisma.provider.findMany({
      where: {
        modelConfigs: {
          some: {
            enabled: true
          }
        }
      },
      select: {
        id: true,      // 确保返回 id
        name: true,
        type: true,
      },
      orderBy: { name: 'asc' }
    });

    console.log('Found providers:', providers); // 添加调试日志
    return json(providers);
  } catch (e) {
    console.error('Error fetching providers:', e);
    throw error(500, 'Failed to fetch providers');
  }
};

// Sanitize input data
function sanitizeProviderData(data: any) {
  return {
    name: String(data.name || '').trim(),
    type: String(data.type || 'openai').trim(),
    baseUrl: String(data.baseUrl || '').trim(),
    // Make sure apiKey is a proper string, remove any error text
    apiKey: typeof data.apiKey === 'string' ? 
      data.apiKey.replace(/TypeError:.*|Error:.*$/g, '').trim() : null,
    isCustom: Boolean(data.isCustom)
  };
}

// POST /api/providers - Create a new provider
export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    const rawData = await request.json();
    
    // Sanitize and validate the data
    const data = sanitizeProviderData(rawData);
    
    // Validate required fields
    if (!data.name || !data.type) {
      return json(
        { error: 'Name and type are required' }, 
        { status: 400 }
      );
    }
    
    console.log('Creating provider with data:', {
      ...data,
      apiKey: data.apiKey ? '***' : null // Mask API key in logs
    });
    
    // Create the provider with API key
    const provider = await prisma.provider.create({
      data: {
        name: data.name,
        type: data.type,
        baseUrl: data.baseUrl,
        apiKey: data.apiKey, // Add API key to the database
        isCustom: data.isCustom
      }
    });
    
    // Don't return API key to frontend
    const { apiKey, ...providerWithoutKey } = provider;
    return json(providerWithoutKey);
  } catch (error) {
    console.error('Error creating provider:', error);
    return json(
      { error: 'Failed to create provider' }, 
      { status: 500 }
    );
  }
};
