import { json } from '@sveltejs/kit';
import { PrismaClient } from '@prisma/client';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const prisma = new PrismaClient();

export const GET: RequestHandler = async ({ url }) => {
  try {
    const providerId = url.searchParams.get('providerId');
    
    // If no providerId is provided, return all models
    if (!providerId) {
      console.log('No providerId provided, returning all models');
      
      const allModels = await prisma.modelConfig.findMany({
        include: {
          provider: {
            select: {
              id: true,
              name: true,
              type: true
            }
          }
        }
      });
      
      return json(allModels);
    }
    
    console.log('Fetching models for provider:', providerId);

    // Check if provider exists
    const provider = await prisma.provider.findUnique({
      where: { id: providerId }
    });

    if (!provider) {
      console.log('Provider not found:', providerId);
      throw error(404, 'Provider not found');
    }

    // Query models for this provider
    const models = await prisma.modelConfig.findMany({
      where: {
        providerId: providerId,
        enabled: true
      }
    });

    console.log(`Provider ${provider.name} (${providerId}) has ${models.length} models:`, 
      models.map(m => ({ id: m.id, name: m.name }))
    );
    
    return json(models);
    
  } catch (e) {
    console.error('Error fetching models:', e);
    if (e.status === 404) throw e;
    throw error(500, 'Failed to fetch models');
  }
}

// POST /api/models - Create a new model
export async function POST({ request }) {
  const data = await request.json();
  
  try {
    // Validate required fields
    if (!data.name || !data.model || !data.apiKey || !data.providerId) {
      throw error(400, 'Name, model, API key, and provider are required fields');
    }
    
    const model = await prisma.modelConfig.create({
      data: {
        name: data.name,
        baseUrl: data.baseUrl || '',
        apiKey: data.apiKey,
        model: data.model,
        enabled: data.enabled !== false,
        providerId: data.providerId
      },
      include: {
        provider: {
          select: {
            name: true,
            type: true
          }
        }
      }
    });
    
    return json(model, { status: 201 });
  } catch (e) {
    console.error('Error creating model:', e);
    // Handle unique constraint violations
    if (e.code === 'P2002') {
      throw error(400, 'A model with this name already exists');
    }
    throw error(500, 'Failed to create model');
  }
}
