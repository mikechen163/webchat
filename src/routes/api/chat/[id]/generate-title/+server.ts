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
-  Using the language same as  user input language
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

    const responseData = await response.text(); // Get raw text first instead of immediate json()
    
    let parsedData;
    try {
      // First try to parse as standard JSON
      parsedData = JSON.parse(responseData);
    } catch (parseError) {
      // If parsing fails, attempt to clean and extract valid JSON
      console.error('Initial JSON parsing failed:', parseError);
      
      // Clean response that might have markdown artifacts
      let cleanedResponse = responseData;
      
      // Remove any markdown code block indicators
      cleanedResponse = cleanedResponse.replace(/```(json|)\s*/g, '');
      cleanedResponse = cleanedResponse.replace(/```\s*$/g, '');
      
      // Try to find JSON object within the text if still not parseable
      const jsonMatch = cleanedResponse.match(/(\{.*\})/s);
      if (jsonMatch) {
        cleanedResponse = jsonMatch[0];
      }
      
      try {
        parsedData = JSON.parse(cleanedResponse);
      } catch (secondParseError) {
        console.error('JSON extraction failed after cleaning:', secondParseError);
        // Fallback to a simple title if all parsing fails
        parsedData = { title: "New Chat" };
      }
    }
    
    // The response data is already parsed here
    let title;
    
    try {
      // If the content is already JSON-parsed as a string, we need to parse it again
      if (typeof parsedData.choices[0].message.content === 'string') {
        try {
          // Check if the content looks like JSON before parsing
          const content = parsedData.choices[0].message.content.trim();
          if (content.startsWith('{') && content.endsWith('}')) {
            const parsed = JSON.parse(content);
            title = parsed.title || content;
          } else {
            // Not valid JSON, use as is
            title = content.substring(0, 30);
          }
        } catch (e) {
          console.error('Failed to parse title from content:', e);
          title = parsedData.choices[0].message.content.substring(0, 30);
        }
      } else if (parsedData.choices[0].message.content.title) {
        // If content was already parsed as an object with title
        title = parsedData.choices[0].message.content.title;
      } else {
        // Fallback
        title = String(parsedData.choices[0].message.content).substring(0, 30);
      }
    } catch (e) {
      console.error('Failed to extract title:', e);
      title = "New Chat";
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
