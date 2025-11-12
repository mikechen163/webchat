/**
 * Intelligent Web Search Service
 * Uses LLM to make decisions about when and how to perform web searches
 */

import type { SearchDecision, SearchAnalysis, UrlContentAnalysis } from '$lib/prompts/web-search-decision';
import { WEB_SEARCH_DECISION_PROMPT, SEARCH_RESULTS_ANALYSIS_PROMPT, URL_CONTENT_ANALYSIS_PROMPT } from '$lib/prompts/web-search-decision';

interface SearchResult {
  title: string;
  url: string;
  description: string;
  [key: string]: any;
}

interface UrlContent {
  url: string;
  content: string;
  type: 'searchResult' | 'urlContent';
}

interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class IntelligentWebSearchService {
  private chatApiEndpoint: string;
  private searchApiEndpoint: string;
  private fetchUrlApiEndpoint: string;
  private modelId: string;

  constructor(chatApiEndpoint: string, searchApiEndpoint: string, fetchUrlApiEndpoint: string, modelId: string) {
    this.chatApiEndpoint = chatApiEndpoint;
    this.searchApiEndpoint = searchApiEndpoint;
    this.fetchUrlApiEndpoint = fetchUrlApiEndpoint;
    this.modelId = modelId;
  }

  /**
   * Main method to perform intelligent web search based on LLM decisions
   */
  async performIntelligentSearch(
    query: string, 
    conversationHistory: ConversationMessage[] = [],
    onProgress?: (progress: any) => void
  ): Promise<{
    searchPerformed: boolean;
    results: any[];
    analysis: any;
    finalAnswer?: string;
  }> {
    
    // Step 1: Let LLM decide if search is needed
    onProgress?.({ status: 'deciding', message: 'Analyzing if web search is needed...' });
    const searchDecision = await this.makeSearchDecision(query, conversationHistory);
    
    if (!searchDecision.requiresSearch) {
      onProgress?.({ status: 'complete', message: 'Search not needed based on analysis' });
      return {
        searchPerformed: false,
        results: [],
        analysis: { reasoning: searchDecision.reasoning }
      };
    }

    // Step 2: Perform initial search based on LLM strategy
    onProgress?.({ status: 'searching', message: 'Performing web search...' });
    let searchResults = await this.executeSearchStrategy(searchDecision.searchStrategy!, onProgress);
    
    // Step 3: Let LLM analyze search results and decide next steps
    onProgress?.({ status: 'analyzing', message: 'Analyzing search results...' });
    let searchAnalysis = await this.analyzeSearchResults(searchResults, query, conversationHistory);
    
    let allResults = [...searchResults];
    let fetchedContent: UrlContent[] = [];
    
    // Step 4: Handle additional searches if needed
    if (searchAnalysis.needsAdditionalSearch) {
      onProgress?.({ status: 'searching', message: 'Performing additional searches...' });
      const additionalResults = await this.performAdditionalSearches(searchAnalysis.nextQueries, onProgress);
      allResults = [...allResults, ...additionalResults];
      
      // Re-analyze with combined results
      searchAnalysis = await this.analyzeSearchResults(allResults, query, conversationHistory);
    }

    // Step 5: Fetch URL content if needed
    if (searchAnalysis.needsMoreDetail && searchAnalysis.urlsToFetch.length > 0) {
      onProgress?.({ status: 'fetching', message: 'Fetching detailed content from URLs...' });
      fetchedContent = await this.fetchUrlContents(searchAnalysis.urlsToFetch, onProgress);
      
      // Let LLM analyze fetched content and decide if more is needed
      const urlAnalysis = await this.analyzeUrlContent(fetchedContent, query, conversationHistory);
      
      // Handle additional URL fetching if needed
      if (urlAnalysis.needsMoreUrls) {
        const additionalContent = await this.fetchUrlContents(urlAnalysis.additionalUrls, onProgress);
        fetchedContent = [...fetchedContent, ...additionalContent];
      }
      
      // Handle additional search if needed
      if (urlAnalysis.needsMoreSearch) {
        const additionalResults = await this.performAdditionalSearches(urlAnalysis.nextSearchQueries, onProgress);
        allResults = [...allResults, ...additionalResults];
      }
    }

    // Step 6: Return combined results
    onProgress?.({ status: 'complete', message: 'Web search completed' });
    
    return {
      searchPerformed: true,
      results: this.combineResults(allResults, fetchedContent),
      analysis: {
        searchDecision,
        searchAnalysis,
        reasoning: searchDecision.reasoning
      }
    };
  }

  /**
   * Step 1: Use LLM to decide if search is needed
   */
  private async makeSearchDecision(query: string, conversationHistory: ConversationMessage[]): Promise<SearchDecision> {
    const prompt = `${WEB_SEARCH_DECISION_PROMPT}

User Query: "${query}"

Conversation History:
${conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

Current Date: ${new Date().toISOString().split('T')[0]}

Please analyze and provide your decision in the specified JSON format.`;

    const response = await this.callChatAPI(prompt, 0.3, 1500);
    
    try {
      const decision = JSON.parse(response) as SearchDecision;
      return decision;
    } catch (error) {
      console.error('Failed to parse search decision:', error);
      // Fallback: assume search is needed if parsing fails
      return {
        requiresSearch: true,
        reasoning: 'Fallback decision due to parsing error',
        searchStrategy: {
          type: 'quick',
          searchQueries: [query],
          maxResults: 10
        },
        nextSteps: ['search', 'analyze_results']
      };
    }
  }

  /**
   * Step 2: Execute search strategy
   */
  private async executeSearchStrategy(strategy: SearchDecision['searchStrategy'], onProgress?: (progress: any) => void): Promise<SearchResult[]> {
    if (!strategy) {
      return [];
    }
    
    const allResults: SearchResult[] = [];
    
    for (const searchQuery of strategy.searchQueries) {
      onProgress?.({ status: 'searching', message: `Searching: ${searchQuery}` });
      
      try {
        const response = await fetch(`${this.searchApiEndpoint}?q=${encodeURIComponent(searchQuery)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.results && Array.isArray(data.results)) {
            allResults.push(...data.results);
          }
        }
      } catch (error) {
        console.error(`Search failed for query: ${searchQuery}`, error);
      }
      
      // Small delay between searches to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Remove duplicates and limit results
    const uniqueResults = this.removeDuplicateResults(allResults);
    return uniqueResults.slice(0, strategy.maxResults || 10);
  }

  /**
   * Step 3: Analyze search results and decide next steps
   */
  private async analyzeSearchResults(searchResults: SearchResult[], query: string, conversationHistory: ConversationMessage[]): Promise<SearchAnalysis> {
    const searchResultsText = searchResults.map((result, index) => 
      `${index + 1}. ${result.title}\n${result.url}\n${result.description}`
    ).join('\n\n');

    const prompt = `${SEARCH_RESULTS_ANALYSIS_PROMPT}

Original Query: "${query}"

Search Results:
${searchResultsText}

Conversation History:
${conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

Please analyze these results and provide your analysis in JSON format.`;

    const response = await this.callChatAPI(prompt, 0.3, 1000);
    
    try {
      return JSON.parse(response) as SearchAnalysis;
    } catch (error) {
      console.error('Failed to parse search analysis:', error);
      // Fallback analysis
      return {
        sufficientResults: true,
        needsMoreDetail: false,
        needsAdditionalSearch: false,
        nextQueries: [],
        urlsToFetch: [],
        reasoning: 'Fallback analysis due to parsing error',
        answerCompleteness: 70,
        confidence: 70
      };
    }
  }

  /**
   * Step 4: Perform additional searches if needed
   */
  private async performAdditionalSearches(queries: string[], onProgress?: (progress: any) => void): Promise<SearchResult[]> {
    const allResults: SearchResult[] = [];
    
    for (const query of queries) {
      onProgress?.({ status: 'searching', message: `Additional search: ${query}` });
      
      try {
        const response = await fetch(`${this.searchApiEndpoint}?q=${encodeURIComponent(query)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.results && Array.isArray(data.results)) {
            allResults.push(...data.results);
          }
        }
      } catch (error) {
        console.error(`Additional search failed for query: ${query}`, error);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return this.removeDuplicateResults(allResults);
  }

  /**
   * Step 5: Fetch content from URLs
   */
  private async fetchUrlContents(urls: string[], onProgress?: (progress: any) => void): Promise<UrlContent[]> {
    const fetchedContent: UrlContent[] = [];
    
    for (const url of urls) {
      onProgress?.({ status: 'fetching', message: `Fetching: ${url}` });
      
      try {
        const response = await fetch(`${this.fetchUrlApiEndpoint}?url=${encodeURIComponent(url)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.content) {
            fetchedContent.push({
              url,
              content: data.content,
              type: 'urlContent'
            });
          }
        }
      } catch (error) {
        console.error(`Failed to fetch URL: ${url}`, error);
      }
      
      // Delay between fetches
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return fetchedContent;
  }

  /**
   * Analyze fetched URL content and decide next steps
   */
  private async analyzeUrlContent(fetchedContent: UrlContent[], query: string, conversationHistory: ConversationMessage[]): Promise<UrlContentAnalysis> {
    const contentSummary = fetchedContent.map((item, index) => 
      `Content ${index + 1} from ${item.url}:\n${item.content.substring(0, 1000)}...`
    ).join('\n\n');

    const prompt = `${URL_CONTENT_ANALYSIS_PROMPT}

Original Query: "${query}"

Fetched Content:
${contentSummary}

Conversation History:
${conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

Please analyze this content and provide your decision in JSON format.`;

    const response = await this.callChatAPI(prompt, 0.3, 1000);
    
    try {
      return JSON.parse(response) as UrlContentAnalysis;
    } catch (error) {
      console.error('Failed to parse URL content analysis:', error);
      return {
        contentSufficient: true,
        needsMoreUrls: false,
        additionalUrls: [],
        needsMoreSearch: false,
        nextSearchQueries: [],
        canAnswer: true,
        confidence: 70,
        reasoning: 'Fallback decision due to parsing error'
      };
    }
  }

  /**
   * Helper method to call the chat API
   */
  private async callChatAPI(prompt: string, temperature: number = 0.3, maxTokens: number = 1500): Promise<string> {
    const response = await fetch(this.chatApiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: prompt,
        modelId: this.modelId,
        temperature,
        max_tokens: maxTokens,
        system: "You are a helpful assistant that returns only valid JSON responses."
      })
    });

    if (!response.ok) {
      throw new Error(`Chat API error: ${response.status}`);
    }

    // Read the stream response
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response stream');
    }

    let result = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += new TextDecoder().decode(value);
    }

    return result;
  }

  /**
   * Helper to remove duplicate search results
   */
  private removeDuplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    return results.filter(result => {
      const key = result.url || result.title;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Combine search results and fetched content
   */
  private combineResults(searchResults: SearchResult[], urlContent: UrlContent[]): any[] {
    const combined = [];
    
    // Add search results
    combined.push(...searchResults.map(result => ({
      type: 'searchResult',
      title: result.title,
      url: result.url,
      description: result.description
    })));
    
    // Add URL content
    combined.push(...urlContent.map(content => ({
      type: 'urlContent',
      url: content.url,
      content: content.content
    })));
    
    return combined;
  }
}