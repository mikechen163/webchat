import { json } from '@sveltejs/kit';
import { PrismaClient } from '@prisma/client';
import { error } from '@sveltejs/kit';

const prisma = new PrismaClient();

// GET /api/providers - List all providers
export async function GET() {
  try {
    const providers = await prisma.provider.findMany({
      orderBy: { name: 'asc' }
    });
    return json(providers);
  } catch (e) {
    console.error('Error fetching providers:', e);
    throw error(500, 'Failed to fetch providers');
  }
}

// POST /api/providers - Create a new provider
export async function POST({ request }) {
  const data = await request.json();
  
  try {
    // Validate required fields
    if (!data.name || !data.type) {
      throw error(400, 'Name and type are required fields');
    }
    
    const provider = await prisma.provider.create({
      data: {
        name: data.name,
        type: data.type,
        baseUrl: data.baseUrl || '',
        isCustom: data.isCustom || false
      }
    });
    
    return json(provider, { status: 201 });
  } catch (e) {
    console.error('Error creating provider:', e);
    // Handle unique constraint violations
    if (e.code === 'P2002') {
      throw error(400, 'A provider with this name already exists');
    }
    throw error(500, 'Failed to create provider');
  }
}
