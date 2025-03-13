<script lang="ts">
  import { page } from "$app/stores";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { onMount } from "svelte";
  import { marked } from "marked";
  import ChatBubble from "$lib/components/ChatBubble.svelte";
  import { toast as showToast } from "$lib/components/ui/toast";
  import { onDestroy } from "svelte";
  import { sessionsStore } from '$lib/stores/sessions';
  import { ArrowUp, Trash2, Search, X, Info } from "lucide-svelte";
  import ModelSelector from "$lib/components/ModelSelector.svelte";
  import { selectedModel } from "$lib/stores/selectedModel";
  import { browser } from "$app/environment";
  import SearchProgressDisplay from "$lib/components/SearchProgressDisplay.svelte";

  // Add the getFullModelName function
  function getFullModelName(model: ModelConfig): string {
    const providerName = model.provider?.name || "其他";
    return `${providerName}/${model.name}`;
  }

  export let data;
  let messages = data.messages || [];
  let messageInput = "";
  let messageContainer: HTMLDivElement;
  let sending = false;
  
  let editingTitle = false;
  let newTitle = data.session.title;

  let autoScroll = true;
  let typingTimeout: NodeJS.Timeout;
  let lastTypingUpdate = 0;

  let viewportHeight = 0;

   // New helper function to fix truncated JSON
   function fixTruncatedJson(text: string): string {
      // Extract what looks like JSON
      const jsonMatch = text.match(/\{[\s\S]*$/);
      if (!jsonMatch) throw new Error('No JSON object found');
      
      let jsonText = jsonMatch[0];
      
      // Count open and close braces
      const openBraces = (jsonText.match(/\{/g) || []).length;
      const closeBraces = (jsonText.match(/\}/g) || []).length;
      
      // Add missing closing braces if needed
      if (openBraces > closeBraces) {
        jsonText += '}'.repeat(openBraces - closeBraces);
      }
      
      // Validate the fixed JSON
      JSON.parse(jsonText);
      return jsonText;
    }

    // Helper function to read stream
    async function streamToText(response: Response): Promise<string> {
      let text = '';
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += new TextDecoder().decode(value);
      }
      return text;
    }
  
  function updateViewportHeight() {
    if (browser) {
      viewportHeight = window.innerHeight;
      document.documentElement.style.setProperty('--viewport-height', `${viewportHeight}px`);
    }
  }

  onMount(() => {
    updateViewportHeight();
    window.addEventListener('resize', updateViewportHeight);
    window.addEventListener('orientationchange', () => {
      // Small delay to ensure the orientation change completes
      setTimeout(updateViewportHeight, 100);
    });

    // On mobile browsers, address bar can appear/disappear causing height changes
    window.visualViewport?.addEventListener('resize', updateViewportHeight);
    
    const draft = localStorage.getItem(`draft_${$page.params.id}`);
    if (draft) messageInput = draft;
  });

  onDestroy(() => {
    if (browser) {
      window.removeEventListener('resize', updateViewportHeight);
      window.visualViewport?.removeEventListener('resize', updateViewportHeight);
    }
    clearTimeout(typingTimeout);
  });

  // 修改工具栏状态控制
  let showTools = false;
  let webSearchMode = false;
  
  // Add search progress state
  let showSearchProgress = false;
  let searchProgress = {
    status: "idle" as "idle" | "analyzing" | "searching" | "fetching" | "complete" | "error",
    query: "",
    searchKeywords: "",
    searchResults: null as any[] | null,
    analysis: null as any | null,
    error: null as string | null,
    currentSubtask: 0,
    totalSubtasks: 0,
    currentKeywords: ""
  };

  // 修改工具选项, 直接使用let声明以确保状态变化会触发响应
  let tools = [
    {
      id: 'websearch',
      label: 'Web Search',
      icon: Search,
      toggle: () => {
        webSearchMode = !webSearchMode;
        console.log('Toggled web search mode:', webSearchMode); // Debug log
        return webSearchMode;
      }
    }
  ];

  $: console.log('Current webSearchMode:', webSearchMode); // 响应式调试日志

  async function analyzeSearchResults(results: any[], originalQuery: string) {
    searchProgress.status = "analyzing";
    
    const analysisPrompt = `Analyze these search results for the query: "${originalQuery}"


1 Use official website for priority.
2 For relevantUrls, think which one is more relevant to the query and in the first 3 place.
3 Exclude site like  businesswire reuters.


Evaluate and return a JSON object with exactly these fields:
{
  "completeness": number (0-100),
  "timeRelevance": number (0-100),
  "queryMatch": number (0-100),
  "needsMoreContent": boolean,
  "relevantUrls": string[],
  "rationale": string (keep it under 100 words)
}

Results: ${JSON.stringify(results, null, 2)}

Important: Keep the response concise and ensure it's valid JSON.`;

    const response = await fetch(`/api/chat/${$page.params.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        content: analysisPrompt,
        modelId: $selectedModel?.id,
        temperature: 0.3,
        max_tokens: 2000,
        system: "You are a search results analyzer. Return only valid JSON, no explanation or formatting.",
        isSearchAnalysis: true // Flag to use search model
      })
    });

    let analysisText = await streamToText(response);
    // Remove any <think>...</think> blocks from the response
    analysisText = analysisText.replace(/<think>[\s\S]*?<\/think>/g, '');
    
    // Improved JSON cleaning function
    const cleanJson = (text: string): string => {
      // Ensure we have a string to work with
      if (!text || typeof text !== 'string') {
        throw new Error('Input must be a non-empty string');
      }

      try {
        // First attempt: Try to parse as-is
        JSON.parse(text);
        return text;
      } catch {
        try {
          // Second attempt: Clean up the text and try to extract JSON
          const cleaned = text.replace(/```json|```/g, '').trim();
          
          // Find the first '{' and last '}'
          const start = cleaned.indexOf('{');
          const end = cleaned.lastIndexOf('}') + 1;
          
          if (start === -1 || end === 0) {
            throw new Error('No JSON object found');
          }
          
          const extracted = cleaned.slice(start, end);
          
          try {
            // Validate the extracted JSON
            JSON.parse(extracted);
            return extracted;
          } catch {
            // If validation fails, try to fix the JSON
            const fixedJson = fixTruncatedJson(extracted);
            return fixedJson;
          }
        } catch (e) {
          console.error('Failed to process JSON:', e.message);
          console.debug('Original text:', text);
          throw new Error(`Invalid JSON structure: ${e.message}`);
        }
      }
    };

    

    try {
      const cleanedText = cleanJson(analysisText);
      //console.log('[Chat] Cleaned JSON text:', cleanedText);
      const analysis = JSON.parse(cleanedText);
      
      // Update search progress with analysis results
      searchProgress.analysis = analysis;
      return analysis;
    } catch (error) {
      console.error('[Chat] JSON parse error:', error, 'Raw text:', analysisText);
      searchProgress.error = "Failed to parse analysis";
      
      // Return a default analysis if parsing fails
      return {
        completeness: 50,
        timeRelevance: 50,
        queryMatch: 50,
        needsMoreContent: true,
        relevantUrls: results.slice(0, 2).map(r => r.url),
        rationale: "Failed to parse analysis, using default values"
      };
    }
  }

    async function fetchUrlContent(url: string) {
      try {
        console.log('[Chat] Fetching content from URL:', url);
        searchProgress.status = "fetching";
        
        const response = await fetch(`/api/fetch-url?url=${encodeURIComponent(url)}`);
        if (!response.ok) throw new Error('URL fetch failed');
        const content = await response.json();
        //console.log('[Chat] Fetched content:', content.text.data);

        return content.text.data;
      } catch (error) {
        console.error('[Chat] URL fetch error:', error);
        return null;
      }
    }

//     async function analyzeUrlContent(content: string, query: string) {
//       const analysisPrompt = `Analyze this content for relevance to query: "${query}"
// Content: ${content.substring(0, 2000)}...

// Return JSON only:
// {
//   "relevance": number,
//   "satisfiesQuery": boolean,
//   "keyInsights": string[],
//   "rationale": string
// }`;

//       const response = await fetch(`/api/chat/${$page.params.id}`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ 
//           content: analysisPrompt,
//           modelId: $selectedModel?.id,
//           // Use low temperature for content analysis
//           temperature: 0.2,
//           max_tokens: 800,
//           system: "You are a content analyzer that only returns valid JSON."
//         })
//       });

//       let analysisText = "";
//       const reader = response.body?.getReader();
//       while (true) {
//         const { done, value } = await reader.read();
//         if (done) break;
//         analysisText += new TextDecoder().decode(value);
//       }

//       // Use the same JSON cleanup function
//       const cleanedText = cleanJson(analysisText);
//       console.log('[Chat] Cleaned URL content analysis:', cleanedText);
//       return JSON.parse(cleanedText);
//     }


  async function performWebSearch(query: string, conversationHistory: any[] = []) {
    console.log('[Chat] Initial search query:', query);
    let searchAttempts = 0;
    const MAX_SEARCH_ATTEMPTS = 1;
    const MAX_URL_FETCHES = 3;
    
    // Reset and show search progress
    searchProgress = {
      status: "analyzing",
      query: query,
      searchKeywords: "",
      searchResults: null,
      analysis: null,
      error: null,
      currentSubtask: 0,
      totalSubtasks: 0,
      currentKeywords: ""
    };
    showSearchProgress = true;
    
    while (searchAttempts < MAX_SEARCH_ATTEMPTS) {
      try {
        // 1. Initial search with conversation history
        const searchResults = await performInitialSearch(query, conversationHistory);
        //console.log('[Chat] Initial search results:', searchResults);
        
        // Update searchProgress with search results
        searchProgress.searchResults = searchResults.results;
        searchProgress.status = "searching";

        // 2. Analyze search results
        const analysis = await analyzeSearchResults(searchResults.results, query);
        //console.log('[Chat] Search results analysis:', analysis);

        // 3. Fetch content from relevant URLs
        const enhancedResults = [];
        
        // First add original search results
        for (const result of searchResults.results) {
          enhancedResults.push({
            type: 'searchResult',
            title: result.title,
            url: result.url,
            description: result.description
          });
        }

        // Then fetch and add content for relevant URLs
        searchProgress.status = "fetching";
        for (const url of analysis.relevantUrls.slice(0, MAX_URL_FETCHES)) {
          const content = await fetchUrlContent(url);
          if (content) {
            enhancedResults.push({
              type: 'urlContent',
              url: url,
              content: content
            });
          }
        }

        // Mark search as complete
        searchProgress.status = "complete";
        
        // Return combined results
        return {
          query,
          results: enhancedResults,
          analysis
        };

      } catch (error) {
        console.error('[Chat] Search optimization error:', error);
        searchProgress.status = "error";
        searchProgress.error = error.message;
        throw error;
      }
    }

    return await performInitialSearch(query, conversationHistory);
  }

  // Add this helper function for executing a single search
  async function executeSearch(searchQuery: string) {
    console.log('[Chat] Executing search for:', searchQuery);
    const encodedQuery = encodeURIComponent(searchQuery);
    const searchResponse = await fetch(`/api/search?q=${encodedQuery}`);
    if (!searchResponse.ok) {
      throw new Error('Search failed');
    }
    return await searchResponse.json();
  }

  // Helper function for the actual search API call
  async function performInitialSearch(query: string, conversationHistory: any[] = []) {
    try {
      searchProgress.status = "analyzing";
      searchProgress.query = query;
      
      // Extract recent conversation context (limit to last few messages to avoid token limits)
      const recentMessages = conversationHistory.slice(-6).map(msg => 
        `${msg.role}: ${msg.content.substring(0, 500)}${msg.content.length > 500 ? '...' : ''}`
      ).join('\n\n');

      //console.log('[Chat] Recent conversation context:', recentMessages);
      
      // 1. 分析用户意图和获取关键词
      const analysisPrompt = `Analyze this query and determine the search strategy:
Query: "${query}"


1. if  this is a topic about China or Chinese culture, people,companies etc, use Chinese for keywords, in other cases, use English for keywords.  
2. Today is ${new Date().toISOString().split('T')[0]} , consider freshness
3. Consider history context when generating keywords.
4. keywords should  be within 3 words
5. use official ir website for financial information , ignore sites like businesswire.com reuters.com

Return a JSON object with exactly these fields:
{
  "requiresSearch": boolean,  // true if the query requires web search to answer accurately
  "reasoning": string,        // brief explanation why search is or isn't needed
  "subtasks": [               // if requiresSearch is true, break down into 1-3 search subtasks
    {
      "question": string,     // specific sub-question
      "keywords": string,     // search keywords in English (unless specifically about Chinese topics)
      "priority": number      // 1-10, importance of this subtask (10 being highest)
    }
  ],
  "considerFreshness": boolean,  // true if recent information is important 
  "considerCompleteness": boolean // true if comprehensive information is important
}
  
Recent conversation context:
${recentMessages}


`;

  console.log('[Chat] Analysis prompt:', analysisPrompt);
  
      const response = await fetch(`/api/chat/${$page.params.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: analysisPrompt,
          modelId: $selectedModel?.id,
          temperature: 0.3,
          max_tokens: 2000,
          system: "You are a query analyzer. Return only valid JSON.",
          isSearchAnalysis: true // Flag to use search model
        })
      });
  
      let analysisText = await streamToText(response);
      analysisText = analysisText.replace(/<think>[\s\S]*?<\/think>/g, '');
      
      const cleanJson = (text: string): string => {
        try {
          // First attempt: Try to parse as-is
          JSON.parse(text);
          return text;
        } catch {
          try {
            // Second attempt: Clean up the text and try to extract JSON
            text = text.replace(/```json|```/g, '').trim();
            
            // Find the first '{' and last '}'
            const start = text.indexOf('{');
            const end = text.lastIndexOf('}') + 1;
            
            if (start === -1 || end === 0) {
              throw new Error('No JSON object found');
            }
            
            const extracted = text.slice(start, end);
            
            // Validate the extracted JSON
            JSON.parse(extracted);
            return extracted;
          } catch (e) {
            // Third attempt: Try to fix truncated JSON
            try {
              const fixedJson = fixTruncatedJson(text);
              return fixedJson;
            } catch {
              console.error('Failed to fix JSON:', text);
              throw new Error('Invalid JSON structure in response');
            }
          }
        }
      };

      const analysis = JSON.parse(cleanJson(analysisText));
      console.log('[Chat] Search analysis:', analysis);
      
      // 2. MODIFIED: Handle multiple search subtasks instead of just the highest priority one
      let allResults = { results: [] };
      
      if (analysis.requiresSearch && analysis.subtasks && Array.isArray(analysis.subtasks) && analysis.subtasks.length > 0) {
        // Sort subtasks by priority (highest first)
        const sortedSubtasks = [...analysis.subtasks].sort((a, b) => 
          (b.priority || 0) - (a.priority || 0)
        );
        
        // Save the keywords for display in the UI
        searchProgress.searchKeywords = sortedSubtasks.map(task => task.keywords).join(' | ');
        
        // Set total subtasks count for progress tracking
        searchProgress.totalSubtasks = sortedSubtasks.length;
        searchProgress.currentSubtask = 0;
        
        // Execute searches for each subtask (up to 3 top priority tasks)
        const MAX_SUBTASKS = 3;
        const subtasksToSearch = sortedSubtasks.slice(0, MAX_SUBTASKS);
        
        for (let i = 0; i < subtasksToSearch.length; i++) {
          const subtask = subtasksToSearch[i];
          searchProgress.currentSubtask = i + 1;
          searchProgress.currentKeywords = subtask.keywords;
          
          if (subtask && typeof subtask.keywords === 'string' && subtask.keywords.trim()) {
            let searchQuery = subtask.keywords.trim();
            
            // Add freshness signal if needed
            if (analysis.considerFreshness) {
              const currentYear = new Date().getFullYear();
              const hasTimeIndicator = /202[3-4]|recent|latest|current|today|yesterday|week|month/i.test(searchQuery);
              if (!hasTimeIndicator) {
                searchQuery += ` ${currentYear}`;
              }
            }
            
            console.log(`[Chat] Searching subtask ${i+1}/${subtasksToSearch.length}: ${searchQuery}`);
            try {
              const subtaskResults = await executeSearch(searchQuery);
              // Wait 1 second between searches to avoid rate limiting
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              // Tag results with their source subtask for potential filtering/grouping later
              const taggedResults = subtaskResults.results.map((result: any) => ({
                ...result,
                subtaskIndex: i,
                subtaskQuestion: subtask.question
              }));
              
              // Merge results
              allResults.results = [...allResults.results, ...taggedResults];
            } catch (searchError) {
              console.error(`[Chat] Error searching subtask ${i+1}:`, searchError);
              // Continue with other subtasks even if one fails
            }
          }
        }
        
        // If no successful searches, fall back to original query
        if (allResults.results.length === 0) {
          console.log('[Chat] No results from subtasks, falling back to original query');
          allResults = await executeSearch(query);
        } else {
          // Remove duplicates by URL
          const uniqueUrls = new Set();
          allResults.results = allResults.results.filter((result: any) => {
            if (uniqueUrls.has(result.url)) {
              return false;
            }
            uniqueUrls.add(result.url);
            return true;
          });
          
          console.log('[Chat] All subtask results:', allResults.results.length);
          // Limit to top results to avoid overwhelming
          const MAX_TOTAL_RESULTS = 45;
          if (allResults.results.length > MAX_TOTAL_RESULTS) {
            allResults.results = allResults.results.slice(0, MAX_TOTAL_RESULTS);
          }
        }
      } else {
        // No subtasks or search not required - fall back to original query
        console.log('[Chat] No subtasks found, using original query');
        allResults = await executeSearch(query);
      }
      
      return {
        ...allResults,
        queryAnalysis: analysis
      };
  
    } catch (error) {
      console.error('[Chat] Search error:', error);
      // Fall back to direct search with original query
      const encodedQuery = encodeURIComponent(query.trim());
      const response = await fetch(`/api/search?q=${encodedQuery}`);
      if (!response.ok) {
        throw new Error('Search failed');
      }
      return await response.json();
    }
  }

  // 添加工具选择处理函数
  function handleToolSelect(toolId: string) {
    // 根据不同工具实现相应功能
    console.log(`Selected tool: ${toolId}`);
    showTools = false;
  }

  // 定期保存草稿
  $: if (messageInput) {
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(saveDraft, 1000);
  }

  async function saveDraft() {
    const now = Date.now();
    if (now - lastTypingUpdate < 5000) return;
    
    lastTypingUpdate = now;
    localStorage.setItem(`draft_${$page.params.id}`, messageInput);
  }

  function handleScroll(e: Event) {
    const target = e.target as HTMLDivElement;
    const atBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100;
    autoScroll = atBottom;
  }

  $: if (autoScroll && messageContainer) {
    messageContainer.scrollTop = messageContainer.scrollHeight;
  }

  let abortController: AbortController | null = null;

  // Add function to fetch user preferences
  async function getUserPreferences() {
    try {
      const response = await fetch("/api/user/preferences");
      if (response.ok) {
        const prefs = await response.json();
        return {
          language: prefs.language || 'en',
          defaultModel: prefs.defaultModel,
          searchModel: prefs.searchModel,
          theme: prefs.theme,
          displayName: prefs.displayName
        };
      }
    } catch (error) {
      console.error("[Chat] Error fetching user preferences:", error);
    }
    
    return { language: 'en' }; // Default fallback
  }

  async function handleSubmit() {
    if (!messageInput.trim() || sending) return;
    
    sending = true;
    abortController = new AbortController();
    const userMessage = messageInput;
    messageInput = "";
    localStorage.removeItem(`draft_${$page.params.id}`);

    try {
      const tempUserMsgId = Date.now().toString();
      const tempAssistantMsgId = (Date.now() + 1).toString();
      
      messages = [...messages, { 
        id: tempUserMsgId,
        role: "user", 
        content: userMessage,
        createdAt: new Date()
      }];

      messages = [...messages, { 
        id: tempAssistantMsgId,
        role: "assistant", 
        content: "",
        createdAt: new Date(),
        modelInfo: $selectedModel ? getFullModelName($selectedModel) : '',  // 添加模型信息
        tokenCount: 0  // 初始化token计数
      }];

      let content = userMessage;
      
      if (webSearchMode) {
        try {
          // Pass both the user message and conversation history
          const searchResults = await performWebSearch(userMessage, messages);
          
          //console.log('[Chat] Search results:', searchResults);

          const formattedResults = searchResults.results
            .map((r: any, index: number) => {
              if (r.type === 'searchResult') {
                return `[${index + 1}] ${r.title}\nURL: ${r.url}\n${r.description}`;
              } else if (r.type === 'urlContent') {
                return `Full content from [${index + 1}] ${r.url}:\n\n${r.content.title}:\n\n${r.content.description}:\n\n${r.content.content}`;
              }
              return '';
            })
            .filter(Boolean)
            .join('\n\n');

          // Fetch user preferences including language
          const userPrefs = await getUserPreferences();
          console.log('[Chat] User preferences:', userPrefs);
          
          // Use the language from preferences, with fallbacks
          let userLang = userPrefs.language || 'en';
          
          // If no preference is set, detect from title as last resort
          if (userLang === 'en' && data.session?.title) {
            const hasChinese = /[\u4e00-\u9fff]/.test(data.session.title);
            if (hasChinese) {
              userLang = 'zh';
              console.log('[Chat] Language detected from title: Chinese');
            }
          }
          
          console.log('[Chat] Using language for response:', userLang);

          // Extract conversation context for the AI to understand user's intent better
          const conversationContext = messages
            .slice(-8, -1) // Get recent messages excluding the latest user message which is already handled
            .map(msg => `${msg.role}: ${msg.content.substring(0, 300)}${msg.content.length > 300 ? '...' : ''}`)
            .join('\n\n');

          const promptTemplate = {
            zh: `你是一个有帮助的助手，请基于前面提供的搜索结果和部分链接的文本，总结整理信息，输出语言为中文。

请做到以下几点：
1. 删除广告、页面导航等不相关信息
2. 请仔细阅读原文,提取关键信息,保留关键数字细节.
3. 如果是财报，请从专业投资者角度仔细分析全部财务数据和管理层信息，给出详细分析结果
4. 使用markdown格式以提高可读性
5. 去掉所有不相关的信息，整合搜索结果，不要包含特殊字符
6. 引用具体信息时包含相关来源编号，如[1]、[2]等（每个编号给出title,用户可以点击对应的url ）
7. 严格遵守中文输出的要求`,

            en: `You are a helpful assistant. Please summarize and organize the information based on the search results and partial link texts provided earlier. Output should be in English.

Please ensure the following:
1. Remove advertisements, page navigation, and other irrelevant information
2. Please read the original text carefully, extract key information, and retain key numerical details.
3. For financial reports, provide detailed analysis from a professional investor's perspective, thoroughly examining all financial data and management information
4. Use markdown format to improve readability
5. Remove all irrelevant information, integrate the search results, and avoid special characters
6. When citing specific information, include relevant source numbers such as [1], [2], etc. (for each item, list title, and users can click on the corresponding URL) 
7. Strictly adhere to the requirement of outputting in English`
          };

          content = `${promptTemplate[userLang] || promptTemplate.en}

<conversation_history>
${conversationContext}
</conversation_history>

<user_input>
${userMessage}
</user_input>

<results>
${formattedResults}
</results>`;

        } catch (error) {
          console.error('[Chat] Web search flow error:', error);
          messages = messages.map(msg => 
            msg.id === tempAssistantMsgId 
              ? { ...msg, content: "I apologize, but I was unable to perform the web search. Please try again later." }
              : msg
          );
          sending = false;
          return;
        }
      }

      // Function to extract URLs from text
      function extractUrls(text: string): string[] {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.match(urlRegex) || [];
      }

      // Process any URLs in user message before proceeding
      const urls = extractUrls(userMessage);
      if (urls.length > 0) {
        // Fetch content from all URLs
        const urlContents = await Promise.all(
          urls.map(async (url) => {
            const content = await fetchUrlContent(url);
            return content ? { url, content } : null;
          })
        );

        // Filter out failed fetches and format content
        const validContents = urlContents
          .filter((result): result is { url: string; content: any } => result !== null)
          .map(({ url, content }) => 
            `Content from URL (${url}):\n${content.title}\n${content.content}`
          )
          .join('\n\n');

        // Append URL contents to the message if any were successfully fetched
        if (validContents) {
          content = `${content}\n\nAdditional URL content:\n${validContents}`;
        }
      }

      const response = await fetch(`/api/chat/${$page.params.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          content,
          modelId: $selectedModel?.id,
          // Use moderate temperature for final response to balance creativity and accuracy
          temperature: 0.7,
          max_tokens: 8000,
        }),
        signal: abortController.signal
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      let assistantResponse = "";
      let tokenCount = 0;

      function updateTokenCount(text: string) {
            // 基于实际文本内容计算 tokens
            // 1. 将文本分割成单词（英文）或字符（中文等）
            const words = text.match(/[\u4e00-\u9fff]|[a-zA-Z0-9]+|\S/g) || [];
            // 2. 估算 token 数量：
            // - 每个中文字符算1个token
            // - 每个英文单词算1个token
            // - 每个标点符号算1个token
            return words.length;
          }
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = new TextDecoder().decode(value);

          
          
          //console.log('[Chat] Response chunk:', chunk); // Debug log
            tokenCount = updateTokenCount(assistantResponse + chunk);
                  
         
          
          assistantResponse += chunk;
                   
          messages = messages.map(msg => {
            if (msg.id === tempAssistantMsgId) {
              return { 
                ...msg, 
                content: assistantResponse,
                tokenCount: tokenCount  // 更新token计数
              };
            }
            return msg;
          });
        }
      } catch (readError) {
        if (readError.name === 'AbortError') {
          throw readError; // Re-throw abort errors to be handled in the main catch block
        }
        throw new Error('Error reading response stream');
      }

      await checkAndUpdateSessionTitle();
      webSearchMode = false;

    } catch (e) {
      if (e.name === 'AbortError') {
        console.log("[Chat] Request cancelled by user");
        // Don't show toast here as it's handled in handleStop
        return;
      } else {
        console.error("[Chat] Submit error:", e);
        showToast({
          title: "Error",
          description: "Failed to send message",
          type: "error"
        });
        messages = messages.slice(0, -1);
        messageInput = userMessage; // Restore the user's input on error
      }
    } finally {
      if (abortController) { // Only reset if not already handled by handleStop
        sending = false;
        abortController = null;
      }
    }
  }

  function handleStop() {
    if (abortController) {
      abortController.abort();
      abortController = null;
      // Remove the last assistant message when stopping
      messages = messages.slice(0, -1);
      // Reset sending state
      sending = false;
      // Restore the user's input
      messageInput = messages[messages.length - 1]?.content || "";
      showToast({
        title: "Cancelled",
        description: "Message generation stopped",
        type: "info"
      });
    }
  }

  async function checkAndUpdateSessionTitle() {
    let retries = 0;
    const maxRetries = 1;
    while (retries < maxRetries) {
      const sessionResponse = await fetch(`/api/chat/${$page.params.id}/session`);
      if (sessionResponse.ok) {
        const sessionData = await sessionResponse.json();
        if (sessionData.title !== data.session.title) {
          data.session = sessionData;
          data = { ...data };
          $sessionsStore.invalidate();
          break;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      retries++;
    }
  }

  async function updateTitle() {
    const response = await fetch(`/api/chat/${$page.params.id}/title`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle })
    });
    
    if (response.ok) {
      editingTitle = false;
      data.session.title = newTitle;
    }
  }

  async function clearHistory() {
    if (!confirm("Are you sure you want to clear the chat history?")) return;
    const response = await fetch(`/api/chat/${$page.params.id}/messages`, {
      method: "DELETE"
    });
    if (response.ok) {
      messages = [];
    }
  }

  function formatMessage(content: string) {
    return marked(content);
  }

  // Function to toggle search progress visibility
  function toggleSearchProgress() {
    showSearchProgress = !showSearchProgress;
  }
</script>

<svelte:head>
  <style>
    :root {
      --viewport-height: 100vh;
    }
    @supports (height: 100dvh) {
      :root {
        --viewport-height: 100dvh;
      }
    }
  </style>
</svelte:head>

<div class="w-full h-[var(--viewport-height)] flex flex-col">
  <div class="flex flex-col flex-1 overflow-hidden">
    <!-- Header -->
    <div class="border-b flex-shrink-0">
      <div class="w-full px-2 md:px-4 py-3 md:py-4 flex items-center justify-center">
        {#if editingTitle}
          <form 
            on:submit|preventDefault={updateTitle}
            class="flex items-center gap-2"
          >
            <Input
              bind:value={newTitle}
              class="w-64"
              autofocus
              on:blur={() => editingTitle = false}
            />
          </form>
        {:else}
          <button 
            type="button"
            class="text-lg md:text-xl font-semibold hover:text-gray-600 text-center truncate max-w-[80%]"
            on:click={() => editingTitle = true}
            on:keydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                editingTitle = true;
              }
            }}
          >
            {data.session.title}
          </button>
        {/if}
        <div class="absolute right-2 md:right-4">
          <Button 
            variant="ghost" 
            size="icon"
            title="Clear History"
            on:click={clearHistory}
            class="h-9 w-9"
          >
            <Trash2 class="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
    
    <!-- Main content area with chat and search progress sidebar -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Messages container -->
      <div 
        class="flex-1 overflow-y-auto overscroll-contain"
        bind:this={messageContainer}
        on:scroll={handleScroll}
      >
        <div class="w-full md:max-w-3xl lg:max-w-4xl mx-auto px-3 md:px-4 py-3 md:py-4 space-y-4">
          {#each messages as message (message.id)}
            <ChatBubble 
              role={message.role}
              content={message.content}
              timestamp={message.createdAt}
              modelInfo={message.modelInfo}
              tokenCount={message.tokenCount}
            />
          {/each}
        </div>
      </div>
      
      <!-- Search Progress Sidebar -->
      {#if webSearchMode && showSearchProgress && searchProgress.status !== "idle"}
        <div class="hidden md:block w-80 lg:w-96 border-l bg-gray-50 overflow-y-auto">
          <SearchProgressDisplay 
            searchProgress={searchProgress} 
            onClose={() => showSearchProgress = false}
            isSidebar={true}
          />
        </div>
        
        <!-- Mobile overlay version -->
        <div class="md:hidden fixed inset-0 bg-black/30 z-50 {showSearchProgress ? 'block' : 'hidden'}">
          <div class="absolute right-0 top-0 bottom-0 w-[85%] max-w-md bg-white shadow-lg overflow-y-auto">
            <SearchProgressDisplay 
              searchProgress={searchProgress} 
              onClose={() => showSearchProgress = false} 
              isSidebar={true}
            />
          </div>
        </div>
      {/if}
    </div>
    
    <!-- Typing Indicator -->
    {#if sending}
      <div class="shrink-0">
        <div class="w-full px-3 md:px-4 py-2 text-sm text-gray-500">
          Bot is typing...
        </div>
      </div>
    {/if}
    
    <!-- Input part -->
    <div class="border-t flex-shrink-0 bg-white sticky bottom-0 left-0 right-0 z-10">
      <div class="w-full md:max-w-3xl lg:max-w-4xl mx-auto px-3 md:px-4 py-3 md:py-4">
        <!-- Tool bar -->
        <div class="mb-2 flex items-center gap-2 text-sm text-gray-600 overflow-x-auto pb-1">
          {#each tools as tool}
            <button 
              class="px-2 md:px-3 py-1 md:py-1.5 rounded-full 
                {tool.id === 'websearch' && webSearchMode ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'} 
                flex items-center gap-1 md:gap-1.5 whitespace-nowrap"
              on:click={() => {
                console.log('Button clicked'); // Debug log
                tool.toggle();
              }}
            >
              <svelte:component this={tool.icon} class="h-4 w-4" />
              <span class="text-xs md:text-sm">{tool.label}</span>
            </button>
          {/each}
          
          <!-- Search progress toggle button -->
          {#if webSearchMode && searchProgress.status !== "idle"}
            <button 
              class="px-2 md:px-3 py-1 md:py-1.5 rounded-full 
                {showSearchProgress ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'} 
                flex items-center gap-1 md:gap-1.5 whitespace-nowrap"
              on:click={toggleSearchProgress}
            >
              <Info class="h-4 w-4" />
              <span class="text-xs md:text-sm">Search Details</span>
            </button>
          {/if}
          
          <div class="h-5 border-l border-gray-200 mx-1"></div>
          <ModelSelector showFullName={true} />
        </div>
        <!-- Message input form -->
        <form on:submit|preventDefault={handleSubmit} class="flex items-center gap-2 max-w-full">
          <Input
            type="text"
            bind:value={messageInput}
            placeholder="Send a Message"
            disabled={sending}
            class="flex-1 h-[40px] md:h-[48px] rounded-[24px] text-sm md:text-base px-4 md:px-6 bg-white border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <div class="flex gap-2">
            {#if sending}
              <Button 
                type="button"
                class="h-10 w-10 md:h-12 md:w-12 rounded-full p-0 flex items-center justify-center bg-red-500 hover:bg-red-600"
                variant="destructive"
                on:click={handleStop}
              >
                <X class="h-5 w-5 md:h-6 md:w-6" />
              </Button>
            {/if}
            <Button 
              type="submit"
              disabled={sending}
              class="h-10 w-10 md:h-12 md:w-12 rounded-full p-0 flex items-center justify-center bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              variant="default"
            >
              {#if sending}
                <div class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              {:else}
                <ArrowUp class="h-5 w-5 md:h-6 md:w-6" />
              {/if}
            </Button>
          </div>
        </form>
        <!-- Bottom padding to ensure content isn't hidden behind keyboard on mobile -->
        <div class="h-2 md:hidden flex-shrink-0"></div>
      </div>
    </div>
  </div>
</div>