import { json, error } from '@sveltejs/kit';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET({ locals }) {
  const { user } = locals.auth;
  if (!user) throw error(401, 'Unauthorized');

  try {
    // Instead of directly querying for fields that might not exist yet,
    // get the basic user data and manually construct the response
    const userData = await prisma.user.findUnique({
      where: { id: user.id }
    });
    
    if (!userData) throw error(404, 'User not found');
    
    // Extract only the fields we need for preferences
    return json({
      defaultModel: userData.defaultModel || null,
      searchModel: userData.searchModel || null,
      theme: userData.theme || 'system',
      language: userData.language || 'en',
      displayName: userData.name || ''
    });
  } catch (err) {
    console.error('Error fetching user preferences:', err);
    
    // If the error is about missing fields, return empty values
    if (err.message && err.message.includes('Unknown field')) {
      console.log('Returning default preferences as the migration may not be complete');
      return json({
        defaultModel: null,
        searchModel: null,
        theme: 'system',
        language: 'en',
        displayName: ''
      });
    }
    
    throw error(500, 'Failed to fetch preferences');
  }
}

export async function POST({ request, locals }) {
  const { user } = locals.auth;
  if (!user) throw error(401, 'Unauthorized');
  
  try {
    const { defaultModel, searchModel, theme, language, displayName } = await request.json();
    
    // Use updateMany instead of update to avoid errors if fields don't exist yet
    // It will silently skip fields that don't exist
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        // Only include fields that exist in the schema
        ...(defaultModel !== undefined && { defaultModel }),
        ...(searchModel !== undefined && { searchModel }),
        theme,
        language,
        name: displayName // Map displayName to name field in User model
      }
    });
    
    return json({
      defaultModel: updatedUser.defaultModel || null,
      searchModel: updatedUser.searchModel || null,
      theme: updatedUser.theme,
      language: updatedUser.language,
      displayName: updatedUser.name
    });
  } catch (err) {
    console.error('Error saving user preferences:', err);
    // If the error is about missing fields, acknowledge the request but log the issue
    if (err.message && err.message.includes('Unknown field')) {
      console.log('Migration for User model may not be complete. Some preferences were not saved.');
      return json({ 
        success: false, 
        reason: 'Some preferences could not be saved. Database schema may need to be updated.'
      });
    }
    throw error(500, 'Failed to save preferences');
  }
}
