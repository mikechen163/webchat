import { json } from '@sveltejs/kit';
import { PrismaClient } from '@prisma/client';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const prisma = new PrismaClient();

// GET /api/models/all - Get all models with provider info
export const GET: RequestHandler = async () => {
  try {
    console.log('Fetching all models with provider info');
    
    const models = await prisma.modelConfig.findMany({
      where: {
        enabled: true
      },
      include: {
        provider: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    const modelsWithProviderNames = models.map(model => {
      // 确保每个模型都有provider信息，如果没有，添加默认值
      if (!model.provider) {
        return {
          ...model,
          provider: { id: 'unknown', name: '其他', type: 'unknown' }
        };
      }
      return model;
    });

    console.log(`Found ${models.length} models`);
    return json(modelsWithProviderNames);
  } catch (e) {
    console.error('Error fetching all models:', e);
    throw error(500, 'Failed to fetch models');
  }
};
