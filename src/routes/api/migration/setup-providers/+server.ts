import { json } from '@sveltejs/kit';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// POST /api/migration/setup-providers - Create default provider and link models
export async function POST() {
  try {
    // Check if we already have providers
    const providerCount = await prisma.provider.count();
    
    if (providerCount === 0) {
      // Create default OpenAI provider
      const defaultProvider = await prisma.provider.create({
        data: {
          name: 'OpenAI',
          type: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          isCustom: false
        }
      });
      
      // Link existing models to this provider
      await prisma.modelConfig.updateMany({
        where: {
          providerId: null
        },
        data: {
          providerId: defaultProvider.id
        }
      });
      
      return json({ 
        success: true, 
        message: 'Default provider created and models linked' 
      });
    } else {
      // Get first provider
      const firstProvider = await prisma.provider.findFirst();
      
      // Link any unlinked models
      if (firstProvider) {
        await prisma.modelConfig.updateMany({
          where: {
            providerId: null
          },
          data: {
            providerId: firstProvider.id
          }
        });
      }
      
      return json({ 
        success: true, 
        message: 'Unlinked models connected to existing provider' 
      });
    }
  } catch (e) {
    console.error('Error setting up providers:', e);
    return json({ 
      success: false, 
      error: e.message || 'Failed to set up providers'
    }, { status: 500 });
  }
}
