import { error, json } from "@sveltejs/kit";
import { PrismaClient } from "@prisma/client";
import type { RequestHandler } from "./$types";

const prisma = new PrismaClient();

export const DELETE: RequestHandler = async ({ params, locals }) => {
  // Verify admin access
  const { user } = locals.auth;
  if (!user || user.role !== "admin") {
    throw error(403, "Unauthorized");
  }

  try {
    // Check if there are models associated with this provider
    const modelCount = await prisma.modelConfig.count({
      where: { providerId: params.id }
    });

    if (modelCount > 0) {
      throw error(400, "Cannot delete provider with associated models");
    }

    await prisma.provider.delete({
      where: { id: params.id }
    });

    return json({ success: true });
  } catch (e) {
    console.error('Error deleting provider:', e);
    if (e.status === 400) throw e;
    if (e.code === 'P2025') {
      throw error(404, 'Provider not found');
    }
    throw error(500, "Failed to delete provider");
  }
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  // Verify admin access
  const { user } = locals.auth;
  if (!user || user.role !== "admin") {
    throw error(403, "Unauthorized");
  }

  const data = await request.json();

  try {
    const provider = await prisma.provider.update({
      where: { id: params.id },
      data
    });

    return json(provider);
  } catch (e) {
    console.error('Error updating provider:', e);
    if (e.code === 'P2025') {
      throw error(404, 'Provider not found');
    }
    throw error(500, "Failed to update provider");
  }
};

export const GET: RequestHandler = async ({ params }) => {
  try {
    const providerId = params.id;
    
    if (!providerId) {
      return json({ error: 'Provider ID is required' }, { status: 400 });
    }

    const provider = await prisma.provider.findUnique({
      where: { id: providerId }
    });

    if (!provider) {
      return json({ error: 'Provider not found' }, { status: 404 });
    }

    return json(provider);
  } catch (error) {
    console.error('Error fetching provider:', error);
    return json({ error: 'Failed to fetch provider' }, { status: 500 });
  }
};

export const PUT: RequestHandler = async ({ request, params }) => {
  try {
    const providerId = params.id;
    const data = await request.json();
    
    if (!providerId) {
      return json({ error: 'Provider ID is required' }, { status: 400 });
    }

    // Only update apiKey if provided, otherwise keep existing
    const currentProvider = await prisma.provider.findUnique({
      where: { id: providerId },
      select: { apiKey: true }
    });

    if (!currentProvider) {
      return json({ error: 'Provider not found' }, { status: 404 });
    }

    // Update provider
    const provider = await prisma.provider.update({
      where: { id: providerId },
      data: {
        name: data.name,
        type: data.type,
        baseUrl: data.baseUrl,
        apiKey: data.apiKey || currentProvider.apiKey,
        isCustom: data.isCustom
      }
    });

    return json(provider);
  } catch (error) {
    console.error('Error updating provider:', error);
    return json({ error: 'Failed to update provider' }, { status: 500 });
  }
};
