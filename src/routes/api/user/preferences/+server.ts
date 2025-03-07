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
    
    //console.log("Found user data:", userData);
    
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
    
    console.log("Received preferences to save:", { defaultModel, searchModel, theme, language, displayName });
    console.log("For user:", user.id);
    
    // Create a data object with all fields we want to update
    const updateData = {};
    
    // Only add fields that are provided in the request
    if (defaultModel !== undefined) updateData.defaultModel = defaultModel;
    if (searchModel !== undefined) updateData.searchModel = searchModel;
    if (theme !== undefined) updateData.theme = theme;
    if (language !== undefined) updateData.language = language;
    if (displayName !== undefined) updateData.name = displayName; // Map displayName to name field
    
    console.log("Update data:", updateData);
    
    try {
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: updateData
      });
      
      //console.log("Updated user:", updatedUser);
      
      return json({
        success: true,
        defaultModel: updatedUser.defaultModel,
        searchModel: updatedUser.searchModel,
        theme: updatedUser.theme,
        language: updatedUser.language,
        displayName: updatedUser.name
      });
    } catch (updateError) {
      console.error("Failed to update user:", updateError);
      
      // If fields don't exist, we need to apply the migration first
      if (updateError.message && updateError.message.includes('Unknown field')) {
        return json({ 
          success: false, 
          message: 'Database schema needs to be updated. Run migration first.',
          error: updateError.message
        }, { status: 400 });
      }
      
      throw updateError;
    }
  } catch (err) {
    console.error('Error saving user preferences:', err);
    return json({ 
      success: false, 
      message: 'Failed to save preferences',
      error: err.message 
    }, { status: 500 });
  }
}
