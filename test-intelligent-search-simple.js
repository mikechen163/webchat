#!/usr/bin/env node

/**
 * Simple test for intelligent web search functionality
 */

import fetch from 'node-fetch';

const CHAT_API_URL = 'http://localhost:3001/api/chat/test-session-id';

async function testIntelligentSearch() {
  console.log('🧪 Testing Intelligent Web Search\n');
  
  const testQueries = [
    {
      query: "What's the current price of Bitcoin?",
      expectedSearch: true,
      reason: "Requires current financial data"
    },
    {
      query: "Tell me a story about a robot",
      expectedSearch: false,
      reason: "Creative writing request"
    },
    {
      query: "What is 2 + 2?",
      expectedSearch: false,
      reason: "Mathematical calculation"
    },
    {
      query: "Who won the Nobel Prize in Physics 2024?",
      expectedSearch: true,
      reason: "Requires current factual information"
    }
  ];

  for (const testCase of testQueries) {
    console.log(`\n📝 Testing: "${testCase.query}"`);
    console.log(`Expected: ${testCase.expectedSearch ? 'Search needed' : 'No search needed'} (${testCase.reason})`);
    
    try {
      // Test with intelligent search enabled
      const response = await fetch(CHAT_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: testCase.query,
          modelId: 'default-model-id',
          enableIntelligentSearch: true,
          temperature: 0.3,
          max_tokens: 500
        })
      });

      if (!response.ok) {
        console.log(`❌ HTTP Error: ${response.status}`);
        continue;
      }

      // Read the response to see what decision was made
      const reader = response.body.getReader();
      let result = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += new TextDecoder().decode(value);
      }

      console.log(`✅ Response received (${result.length} characters)`);
      
      // Check if the response mentions web search or shows search analysis
      if (result.toLowerCase().includes('search') || result.toLowerCase().includes('web')) {
        console.log(`🔍 Response mentions search-related terms`);
      }
      
      // Show first 200 characters of response
      console.log(`Response preview: ${result.substring(0, 200)}...`);

    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }

    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

async function testTraditionalVsIntelligent() {
  console.log('\n🧪 Comparing Traditional vs Intelligent Search\n');
  
  const testQuery = "What's the latest news about AI?";
  
  console.log(`Testing with query: "${testQuery}"`);
  
  // Test 1: Traditional search (no intelligent decision)
  console.log('\n1. Traditional Search (enableIntelligentSearch: false)');
  try {
    const response1 = await fetch(CHAT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: testQuery,
        modelId: 'default-model-id',
        enableIntelligentSearch: false,
        temperature: 0.3,
        max_tokens: 500
      })
    });

    if (response1.ok) {
      const reader = response1.body.getReader();
      let result = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += new TextDecoder().decode(value);
      }
      console.log(`Traditional result preview: ${result.substring(0, 150)}...`);
    }
  } catch (error) {
    console.log(`Traditional search error: ${error.message}`);
  }

  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 2: Intelligent search
  console.log('\n2. Intelligent Search (enableIntelligentSearch: true)');
  try {
    const response2 = await fetch(CHAT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: testQuery,
        modelId: 'default-model-id',
        enableIntelligentSearch: true,
        temperature: 0.3,
        max_tokens: 500
      })
    });

    if (response2.ok) {
      const reader = response2.body.getReader();
      let result = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += new TextDecoder().decode(value);
      }
      console.log(`Intelligent result preview: ${result.substring(0, 150)}...`);
    }
  } catch (error) {
    console.log(`Intelligent search error: ${error.message}`);
  }
}

async function main() {
  console.log('🚀 Starting Intelligent Web Search Tests\n');
  
  // Check if server is running
  try {
    const healthCheck = await fetch('http://localhost:3001');
    console.log('✅ Server is running on port 3001');
  } catch (error) {
    console.log('❌ Cannot connect to server. Make sure it\'s running on port 3001');
    return;
  }

  await testIntelligentSearch();
  await testTraditionalVsIntelligent();
  
  console.log('\n✅ All tests completed!');
}

// Run tests
main().catch(console.error);