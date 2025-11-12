/**
 * Prompt templates for LLM-based web search decision making
 */

export interface SearchDecision {
  requiresSearch: boolean;
  reasoning: string;
  searchStrategy?: {
    type: 'comprehensive' | 'quick' | 'fact_check' | 'deep_dive';
    searchQueries: string[];
    maxResults: number;
    timeSensitivity?: boolean;
    domainFilter?: string[];
  };
  nextSteps: ('search' | 'analyze_results' | 'fetch_urls' | 'complete')[];
  urlFetchStrategy?: {
    selectUrls: string[];
    fetchDepth: 'summary' | 'detailed' | 'selective';
    maxContentLength: number;
  };
}

export interface SearchAnalysis {
  sufficientResults: boolean;
  needsMoreDetail: boolean;
  needsAdditionalSearch: boolean;
  nextQueries: string[];
  urlsToFetch: string[];
  reasoning: string;
  answerCompleteness: number;
  confidence: number;
}

export interface UrlContentAnalysis {
  contentSufficient: boolean;
  needsMoreUrls: boolean;
  additionalUrls: string[];
  needsMoreSearch: boolean;
  nextSearchQueries: string[];
  canAnswer: boolean;
  confidence: number;
  reasoning: string;
}

export const WEB_SEARCH_DECISION_PROMPT = `You are an intelligent assistant that can decide when and how to use web search to provide the best possible answer to user queries.

Your task is to analyze the user's query and conversation history, then decide:
1. Whether web search is needed to answer the query accurately
2. What search strategy to use if search is needed
3. What steps to take after search (analyze results, fetch URLs, etc.)

Consider these factors:
- **Factual queries**: Current events, statistics, recent developments, specific facts
- **Time-sensitive**: News, stock prices, weather, recent updates
- **Comprehensive topics**: Complex subjects that benefit from multiple sources
- **Verification**: Fact-checking claims or getting different perspectives
- **Specific details**: Technical specifications, prices, availability, contact info

**Decision Criteria:**
- Use web search for: current events, factual verification, recent data, comprehensive research
- Skip web search for: personal advice, creative writing, general knowledge, coding help, math problems

**Response Format (JSON only):**
{\n  "requiresSearch": boolean,                    // true if search is needed\n  "reasoning": "Brief explanation of your decision",\n  "searchStrategy": {                           // only if requiresSearch is true\n    "type": "comprehensive|quick|fact_check|deep_dive",\n    "searchQueries": ["query1", "query2"],       // 1-3 specific search queries\n    "maxResults": number,                        // 5-20 results to consider\n    "timeSensitivity": boolean,                  // true if fresh information matters\n    "domainFilter": ["domain1.com", "domain2.org"] // optional: preferred domains\n  },\n  "nextSteps": ["search", "analyze_results", "fetch_urls", "complete"],\n  "urlFetchStrategy": {                         // only if you plan to fetch URLs\n    "selectUrls": ["url1", "url2"],              // specific URLs to fetch\n    "fetchDepth": "summary|detailed|selective",  // how much content to extract\n    "maxContentLength": number                   // max characters to fetch per URL\n  }\n}`;

export const SEARCH_RESULTS_ANALYSIS_PROMPT = `You have received search results for the user's query. Analyze them and decide what to do next.

**Consider:**
- Are the results sufficient to answer the query completely?
- Do you need more detailed information from specific URLs?
- Should you perform additional searches with different queries?
- Are there gaps in the information that need to be filled?

**Response Format (JSON only):**
{\n  "sufficientResults": boolean,                 // true if current results are enough\n  "needsMoreDetail": boolean,                   // true if URL content fetching is needed\n  "needsAdditionalSearch": boolean,             // true if more searches are needed\n  "nextQueries": ["query1", "query2"],          // additional search queries if needed\n  "urlsToFetch": ["url1", "url2"],              // specific URLs to get detailed content\n  "reasoning": "Explanation of your analysis and next steps",\n  "answerCompleteness": number,                 // 0-100: how complete the answer can be\n  "confidence": number                          // 0-100: confidence in the available information\n}`;

export const URL_CONTENT_ANALYSIS_PROMPT = `You have fetched detailed content from web pages. Analyze this content and decide:

1. Does this content sufficiently answer the user's query?
2. Are there other URLs that should be fetched for more information?
3. Should you perform additional searches?
4. Can you now provide a complete answer?

**Response Format (JSON only):**
{\n  "contentSufficient": boolean,                 // true if fetched content is enough\n  "needsMoreUrls": boolean,                     // true if more URLs should be fetched\n  "additionalUrls": ["url1", "url2"],            // more URLs to fetch if needed\n  "needsMoreSearch": boolean,                   // true if additional searches needed\n  "nextSearchQueries": ["query1"],              // new search queries if needed\n  "canAnswer": boolean,                         // true if you can now answer the query\n  "confidence": number,                         // 0-100: confidence in completeness\n  "reasoning": "Brief explanation of your decision"\n}`;