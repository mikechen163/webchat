#!/usr/bin/env node

/**
 * Simple test for intelligent web search decision making
 */

const fetch = require('node-fetch');

async function testSearchDecision() {
  console.log('🧪 Testing Search Decision Logic\n');
  
  const testCases = [
    {
      query: "What's the current price of Bitcoin?",
      expected: true,
      reason: "Requires current financial data"
    },
    {
      query: "Tell me a story about a robot",
      expected: false,
      reason: "Creative writing, doesn't need web search"
    },
    {
      query: "What is 2 + 2?",
      expected: false,
      reason: "Simple math, doesn't need web search"
    },
    {
      query: "Who won the Nobel Prize in Physics 2024?",
      expected: true,
      reason: "Requires current factual information"
    },
    {
      query: "What are the latest AI developments?",
      expected: true,
      reason: "Requires current information"
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n📝 Testing: "${testCase.query}"`);
    console.log(`Expected search needed: ${testCase.expected} (${testCase.reason})`);
    
    try {
      // Simulate the LLM decision making
      const decision = await simulateLLMDecision(testCase.query);
      console.log(`Actual decision: ${decision.requiresSearch}`);
      console.log(`Reasoning: ${decision.reasoning}`);
      
      if (decision.requiresSearch === testCase.expected) {
        console.log('✅ PASS');
      } else {
        console.log('❌ FAIL');
      }
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
}

async function simulateLLMDecision(query) {
  // This is a simplified simulation of what the LLM would decide
  // In reality, this would call your actual LLM endpoint
  
  const searchIndicators = [
    /current|latest|today|now|recent/i,
    /price|stock|bitcoin|crypto/i,
    /news|event|happened|announced/i,
    /2024|2023|this year/i,
    /who won|who is|what is the/i
  ];
  
  const noSearchIndicators = [
    /tell me a story|write a story/i,
    /what is \d+\s*[+\-*/]\s*\d+/i,
    /help me with|how do i|can you explain/i,
    /write|create|generate/i
  ];

  // Check if query needs web search
  const needsSearch = searchIndicators.some(pattern => pattern.test(query)) &&
                     !noSearchIndicators.some(pattern => pattern.test(query));

  // Generate reasoning
  let reasoning = '';
  if (needsSearch) {
    if (/current|latest|today/i.test(query)) reasoning = 'Query asks for current/recent information';
    else if (/price|stock/i.test(query)) reasoning = 'Query asks for current financial data';
    else if (/news|event/i.test(query)) reasoning = 'Query asks about recent events or news';
    else if (/2024|this year/i.test(query)) reasoning = 'Query asks about current year information';
    else reasoning = 'Query requires factual, time-sensitive information';
  } else {
    if (/tell.*story|write.*story/i.test(query)) reasoning = 'Query is creative writing request';
    else if (/what is \d+\s*[+\-*/]\s*\d+/i.test(query)) reasoning = 'Query is a mathematical calculation';
    else if (/help me|how do|explain/i.test(query)) reasoning = 'Query asks for explanation or help';
    else reasoning = 'Query can be answered with general knowledge';
  }

  return {
    requiresSearch: needsSearch,
    reasoning: reasoning,
    searchStrategy: needsSearch ? {
      type: 'quick',
      searchQueries: [query],
      maxResults: 10,
      timeSensitivity: /current|latest|today/i.test(query)
    } : undefined,
    nextSteps: needsSearch ? ['search', 'analyze_results'] : ['complete']
  };
}

// Run the test
testSearchDecision().catch(console.error);