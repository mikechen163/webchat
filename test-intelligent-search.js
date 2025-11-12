#!/usr/bin/env node

/**
 * Test script for intelligent web search functionality
 */

const fetch = require('node-fetch');

const CHAT_API_URL = 'http://localhost:5173/api/chat/test-session-id';
const SEARCH_API_URL = 'http://localhost:5173/api/search';
const FETCH_URL_API = 'http://localhost:5173/api/fetch-url';

// Test queries that should trigger web search
const testQueries = [
  "What's the latest news about AI in 2024?",
  "What is the current price of Bitcoin?",
  "Who won the Nobel Prize in Physics this year?",
  "What's the weather like in Tokyo today?",
  "Tell me a story about a robot", // This should NOT trigger web search
  "What is 2 + 2?", // This should NOT trigger web search
  "What are the latest developments in quantum computing?",
  "Who is the current CEO of OpenAI?"
];

async function testIntelligentSearch() {
  console.log('🧪 Testing Intelligent Web Search Functionality\n');

  for (const query of testQueries) {
    console.log(`\n📝 Testing query: "${query}"`);
    
    try {
      // Test the intelligent search decision
      const response = await fetch(CHAT_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: query,
          modelId: 'default-model-id', // This should be a valid model ID from your DB
          enableIntelligentSearch: true,
          isSearchAnalysis: true, // This will trigger the decision logic
          temperature: 0.3,
          max_tokens: 1500
        })
      });

      if (!response.ok) {
        console.log(`❌ HTTP Error: ${response.status}`);
        continue;
      }

      // Read the response
      const reader = response.body.getReader();
      let result = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += new TextDecoder().decode(value);
      }

      console.log(`✅ Response received: ${result.substring(0, 200)}...`);
      
      // Try to parse as JSON (it should be a search decision)
      try {
        const decision = JSON.parse(result);
        console.log(`🔍 Search Decision:`);
        console.log(`   - Requires Search: ${decision.requiresSearch}`);
        console.log(`   - Reasoning: ${decision.reasoning}`);
        if (decision.searchStrategy) {
          console.log(`   - Strategy: ${decision.searchStrategy.type}`);
          console.log(`   - Queries: ${decision.searchStrategy.searchQueries.join(', ')}`);
        }
      } catch (parseError) {
        console.log(`⚠️  Could not parse as JSON, might be a regular response`);
      }

    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }

    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

async function testTraditionalSearch() {
  console.log('\n🧪 Testing Traditional Web Search\n');
  
  const testQuery = "What is the latest news about AI?";
  
  try {
    const response = await fetch(`${SEARCH_API_URL}?q=${encodeURIComponent(testQuery)}`);
    
    if (!response.ok) {
      console.log(`❌ Search API Error: ${response.status}`);
      return;
    }
    
    const data = await response.json();
    console.log(`✅ Search results: ${data.results?.length || 0} items found`);
    
    if (data.results && data.results.length > 0) {
      console.log('📊 First result:');
      console.log(`   Title: ${data.results[0].title}`);
      console.log(`   URL: ${data.results[0].url}`);
      console.log(`   Description: ${data.results[0].description?.substring(0, 100)}...`);
    }
    
  } catch (error) {
    console.log(`❌ Search Error: ${error.message}`);
  }
}

async function testUrlFetching() {
  console.log('\n🧪 Testing URL Content Fetching\n');
  
  const testUrl = "https://example.com";
  
  try {
    const response = await fetch(`${FETCH_URL_API}?url=${encodeURIComponent(testUrl)}`);
    
    if (!response.ok) {
      console.log(`❌ Fetch URL Error: ${response.status}`);
      return;
    }
    
    const data = await response.json();
    console.log(`✅ URL content fetched successfully`);
    console.log(`   Content length: ${data.content?.length || 0} characters`);
    console.log(`   First 200 chars: ${data.content?.substring(0, 200)}...`);
    
  } catch (error) {
    console.log(`❌ Fetch Error: ${error.message}`);
  }
}

async function main() {
  console.log('🚀 Starting Intelligent Web Search Tests\n');
  
  // Check if the server is running
  try {
    const healthCheck = await fetch('http://localhost:5173');
    if (!healthCheck.ok) {
      console.log('❌ Server is not responding properly');
      return;
    }
    console.log('✅ Server is running');
  } catch (error) {
    console.log('❌ Cannot connect to server. Make sure it\'s running on port 5173');
    return;
  }

  // Run tests
  await testIntelligentSearch();
  await testTraditionalSearch();
  await testUrlFetching();
  
  console.log('\n✅ All tests completed!');
}

// Run the tests
main().catch(console.error);