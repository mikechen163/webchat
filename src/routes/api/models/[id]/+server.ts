import { json } from '@sveltejs/kit';
import { PrismaClient } from '@prisma/client';
import { error } from '@sveltejs/kit';

const prisma = new PrismaClient();

// DELETE /api/models/:id - Delete a model
export async function DELETE({ params }) {
  try {
    await prisma.modelConfig.delete({
      where: { id: params.id }
    });
    
    return json({ success: true });
  } catch (e) {
    console.error('Error deleting model:', e);
    if (e.code === 'P2025') {
      throw error(404, 'Model not found');
    }
    throw error(500, 'Failed to delete model');
  }
}

// PATCH /api/models/:id - Update a model
export async function PATCH({ params, request }) {
  const data = await request.json();
  
  try {
    const model = await prisma.modelConfig.update({
      where: { id: params.id },
      data,
      include: {
        provider: {
          select: {
            name: true,
            type: true
          }
        }
      }
    });
    
    return json(model);
  } catch (e) {
    console.error('Error updating model:', e);
    if (e.code === 'P2025') {
      throw error(404, 'Model not found');
    }
    throw error(500, 'Failed to update model');
  }
}
