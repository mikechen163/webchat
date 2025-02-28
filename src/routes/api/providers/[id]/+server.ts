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
