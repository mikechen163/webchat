import { redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db/client';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  try {
    // Check if user is authenticated and has admin role
    const session =  locals.auth;
    if (!session || session.user.role !== 'admin') {
      throw redirect(302, '/chat');
    }

    // Fetch all model configurations from database
    const models = await prisma.modelConfig.findMany({
      orderBy: { name: 'asc' }
    });
    
    // Mask API keys for security (show last 4 chars only)
    const maskedModels = models.map(model => ({
      ...model,
      apiKey: model.apiKey ? `••••${model.apiKey.slice(-4)}` : '',
      originalApiKey: '' // Empty placeholder for new API key
    }));
    
    return {
      models: maskedModels
    };
  } catch (error) {
    console.error('Error loading model configurations:', error);
    
    // If there's an error but it's not a redirect, return an empty models array
    if (!(error instanceof Response)) {
      return {
        models: [],
        loadError: 'Failed to load model configurations'
      };
    }
    
    // Re-throw redirect responses
    throw error;
  }
};

export const actions: Actions = {
  updateModel: async ({ request }) => {
    const formData = await request.formData();
    const id = formData.get('id') as string;
    const name = formData.get('name') as string;
    const baseUrl = formData.get('baseUrl') as string;
    const model = formData.get('model') as string;
    const apiKey = formData.get('apiKey') as string;
    const enabled = formData.get('enabled') === 'on';
    
    // If ID exists, update existing model
    if (id) {
      // Only update API key if a new one was provided
      if (apiKey.startsWith('••••')) {
        // API key wasn't changed, don't update it
        await prisma.modelConfig.update({
          where: { id },
          data: { name, baseUrl, model, enabled }
        });
      } else {
        // New API key provided, update everything
        await prisma.modelConfig.update({
          where: { id },
          data: { name, baseUrl, model, apiKey, enabled }
        });
      }
    } else {
      // Create a new model config
      await prisma.modelConfig.create({
        data: { name, baseUrl, model, apiKey, enabled }
      });
    }
    
    return { success: true };
  },
  
  deleteModel: async ({ request }) => {
    const formData = await request.formData();
    const id = formData.get('id') as string;
    
    await prisma.modelConfig.delete({
      where: { id }
    });
    
    return { success: true };
  }
};
