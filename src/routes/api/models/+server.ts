import { json } from '@sveltejs/kit';
import { PrismaClient } from '@prisma/client';
import { error } from '@sveltejs/kit';

const prisma = new PrismaClient();

// GET /api/models - List all models
export async function GET() {
  try {
    const models = await prisma.modelConfig.findMany({
      include: {
        provider: {
          select: {
            name: true,
            type: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });
    return json(models);
  } catch (e) {
    console.error('Error fetching models:', e);
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
