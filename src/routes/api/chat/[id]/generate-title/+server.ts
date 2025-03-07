import { error } from '@sveltejs/kit';
import { PrismaClient } from '@prisma/client';
import { json } from '@sveltejs/kit';

const prisma = new PrismaClient();

export async function POST({ params, locals, request }) {
  try {
    // Get the session
    const session = await prisma.session.findUnique({
      where: { id: params.id },
      include: { user: true }
    });
    
    if (!session) {
      throw error(404, "Session not found");
    }
    
    // Get messages for the chat
    const messages = await prisma.message.findMany({
      where: { sessionId: params.id },
      orderBy: { createdAt: 'asc' },
      select: { role: true, content: true }
    });
    
    if (messages.length < 2) {
      throw error(400, "Not enough messages for title generation");
    }
    
    // Get user's default model or any enabled model
    let modelConfig;
    
    if (session.user) {
      // Get the user's default model
      const userData = await prisma.user.findUnique({
        where: { id: session.user.id }
      });
      
      if (userData?.defaultModel) {
        modelConfig = await prisma.modelConfig.findFirst({
          where: { 
            id: userData.defaultModel,
            enabled: true 
          }
        });
      }
    }
    
    // If no user model preference or not found, get any enabled model
    if (!modelConfig) {
      modelConfig = await prisma.modelConfig.findFirst({
        where: { enabled: true }
      });
      
      if (!modelConfig) {
        throw error(500, "No enabled model configuration found");
      }
    }
    
    // Generate the title using the user's preferred model
    const prompt = `### Task:
Generate a concise, 3-5 word title with an emoji summarizing the chat history.
### Guidelines:
- The title should clearly represent the main theme or subject of the conversation.
- Use emojis that enhance understanding of the topic, but avoid quotation marks or special formatting.
- Write the title in the chat's primary language; default to English if multilingual.
- Prioritize accuracy over excessive creativity; keep it clear and simple.
### Output:
JSON format: { "title": "your concise title here" }
### Chat History:
${messages.map(m => `${m.role}: ${m.content}`).join('\n')}`;

    const response = await fetch(`${modelConfig.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${modelConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: modelConfig.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: modelConfig.temperature,
        max_tokens: 100
      }),
    });

    if (!response.ok) {
      console.error('Title generation API error:', response.status, response.statusText);
      throw error(500, 'Failed to generate title');
    }

    const data = await response.json();
    let title;
    
    try {
      const parsed = JSON.parse(data.choices[0].message.content);
      title = parsed.title;
    } catch (e) {
      console.error('Failed to parse title response:', e);
      // Fallback to using the first part of the response if JSON parsing fails
      title = data.choices[0].message.content.split('\n')[0].substring(0, 30) + '...';
    }

    // Update the session title
    await prisma.session.update({
      where: { id: params.id },
      data: { title }
    });

    return json({ title });

  } catch (e) {
    console.error('Title generation error:', e);
    throw error(500, e.message);
  }
}
