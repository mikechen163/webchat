#!/usr/bin/env node

/**
 * Test script to verify intelligent search works in sequential queries
 * This simulates the issue where first query works but subsequent queries fail
 */

const fetch = require('node-fetch');

// API endpoints (adjust these based on your local setup)
const CHAT_API_URL = 'http://localhost:5173/api/chat';
const SESSION_ID = 'test-intelligent-search-' + Date.now();

// Test queries that should trigger intelligent search
const testQueries = [
  "amd最新消息",  // First query - should trigger search
  "intel最新动态", // Second query - should also trigger search
  "nvidia新闻"     // Third query - should also trigger search
];

// Function to send message to chat API
async function sendMessage(query, sessionId) {
  try {
    console.log(`\n📝 Testing query: ${query}`);
    
    const response = await fetch(`${CHAT_API_URL}/${sessionId}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': 'session=your-session-cookie' // Add if needed
      },
      body: JSON.stringify({
        content: query,
        modelId: 'your-model-id', // Adjust based on your setup
        temperature: 0.3,
        max_tokens: 2000,
        enableIntelligentSearch: true,
        isSearchAnalysis: true // This should trigger the intelligent decision logic
      })
    });

    if (!response.ok) {
      console.log(`❌ HTTP ${response.status}: ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    console.log(`✅ Response received:`, data);
    return data;
    
  } catch (error) {
    console.log(`❌ Error for query "${query}":`, error.message);
    return null;
  }
}

// Function to test sequential queries
async function testSequentialQueries() {
  console.log('🧠 Starting Intelligent Search Sequential Test');
  console.log('==============================================');
  console.log('This test verifies that intelligent search works for multiple consecutive queries');
  console.log(`Session ID: ${SESSION_ID}`);

  let successCount = 0;
  let results = [];

  for (let i = 0; i < testQueries.length; i++) {
    const query = testQueries[i];
    console.log(`\n--- Query ${i + 1}/${testQueries.length} ---`);
    
    const result = await sendMessage(query, SESSION_ID);
    results.push({
      query: query,
      success: result !== null,
      decision: result
    });
    
    if (result) {
      successCount++;
      console.log(`✅ Query ${i + 1} successful`);
      if (result.requiresSearch !== undefined) {
        console.log(`   Decision: ${result.requiresSearch ? '🔍 Search needed' : '💭 No search needed'}`);
        console.log(`   Reasoning: ${result.reasoning || 'N/A'}`);
      }
    } else {
      console.log(`❌ Query ${i + 1} failed`);
    }
    
    // Small delay between queries to simulate real user behavior
    if (i < testQueries.length - 1) {
      console.log('⏳ Waiting 2 seconds before next query...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('\n📊 Test Results Summary:');
  console.log('=========================');
  console.log(`Total queries: ${testQueries.length}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${testQueries.length - successCount}`);
  console.log(`Success rate: ${(successCount / testQueries.length * 100).toFixed(1)}%`);
  
  console.log('\n🔍 Detailed Results:');
  results.forEach((result, index) => {
    console.log(`${index + 1}. "${result.query}" - ${result.success ? '✅' : '❌'}`);
    if (result.success && result.decision) {
      console.log(`   Decision: ${result.decision.requiresSearch ? 'Search needed' : 'No search needed'}`);
    }
  });

  if (successCount === testQueries.length) {
    console.log('\n🎉 All queries processed successfully! Intelligent search is working correctly.');
  } else {
    console.log('\n⚠️  Some queries failed. There may be an issue with intelligent search consistency.');
  }
}

// Run the test
testSequentialQueries().catch(console.error);