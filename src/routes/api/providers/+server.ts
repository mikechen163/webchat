import { json } from '@sveltejs/kit';
import { PrismaClient } from '@prisma/client';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const prisma = new PrismaClient();

// GET /api/providers - List all providers
export const GET: RequestHandler = async ({ locals }) => {
  // Check authentication
  const session = locals.auth;
  if (!session || session.user.role !== 'admin') {
    throw error(403, 'Unauthorized');
  }

  try {
    const providers = await prisma.provider.findMany({
      orderBy: { name: 'asc' }
    });
    return json(providers);
  } catch (e) {
    console.error('Error fetching providers:', e);
    throw error(500, 'Failed to fetch providers');
  }
};

// POST /api/providers - Create a new provider
export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    const data = await request.json();
    console.log("Received provider data:", data);
    
    // Validate required fields
    if (!data.name || !data.name.trim()) {
      console.error("Missing required field: name");
      throw error(400, 'Name is required and cannot be empty');
    }
    
    if (!data.type || !data.type.trim()) {
      console.error("Missing required field: type");
      throw error(400, 'Type is required and cannot be empty');
    }
    
    // Create provider with sanitized data
    const providerData = {
      name: data.name.trim(),
      type: data.type.trim(),
      baseUrl: data.baseUrl?.trim() || '',
      isCustom: Boolean(data.isCustom)
    };
    
    console.log("Creating provider with data:", providerData);
    
    const provider = await prisma.provider.create({
      data: providerData
    });
    
    return json(provider, { status: 201 });
  } catch (e) {
    console.error('Error creating provider:', e);
    
    // Check if it's already a handled error
    if (e.status && e.body) {
      throw e;
    }
    
    // Handle unique constraint violations
    if (e.code === 'P2002') {
      throw error(400, 'A provider with this name already exists');
    }
    
    throw error(500, 'Failed to create provider');
  }
};
