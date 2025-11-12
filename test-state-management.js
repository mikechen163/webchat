#!/usr/bin/env node

/**
 * Simple test to verify webSearchMode state management
 * This checks if webSearchMode is properly reset after each query
 */

console.log('🧪 Testing Intelligent Search State Management');
console.log('==============================================');

// Simulate the state variables like in the frontend
let intelligentSearchMode = true;  // Default enabled
let webSearchMode = false;         // Should start as false

// Simulate the decision logic
function shouldPerformIntelligentSearch() {
  return intelligentSearchMode && !webSearchMode;
}

// Simulate a query processing
function processQuery(query) {
  console.log(`\n📝 Processing query: "${query}"`);
  console.log(`   Before: intelligentSearchMode=${intelligentSearchMode}, webSearchMode=${webSearchMode}`);
  
  // Check if we should do intelligent search decision
  if (shouldPerformIntelligentSearch()) {
    console.log('   ✅ Intelligent search decision: ACTIVE');
    
    // Simulate LLM deciding search is needed
    const searchNeeded = query.includes('news') || query.includes('最新');
    console.log(`   🤖 LLM Decision: ${searchNeeded ? 'Search needed' : 'No search needed'}`);
    
    if (searchNeeded) {
      webSearchMode = true;  // Temporarily enable for this query
      console.log('   🔧 webSearchMode set to: true');
    }
    
  } else {
    console.log('   ❌ Intelligent search decision: SKIPPED (webSearchMode is true)');
  }
  
  // Simulate the actual web search processing
  if (webSearchMode) {
    console.log('   🔍 Performing web search...');
    // ... search logic here ...
  }
  
  // Reset webSearchMode after processing (this is our fix)
  if (webSearchMode && intelligentSearchMode) {
    webSearchMode = false;
    console.log('   🔄 webSearchMode reset to: false');
  }
  
  console.log(`   After: intelligentSearchMode=${intelligentSearchMode}, webSearchMode=${webSearchMode}`);
}

// Test sequence
console.log('Testing sequential queries to verify state management:');

const queries = [
  "amd最新消息",      // Should trigger intelligent search
  "tell me a story",  // Should trigger intelligent search  
  "intel新闻"         // Should trigger intelligent search (this would fail without the fix)
];

queries.forEach((query, index) => {
  console.log(`\n--- Test ${index + 1} ---`);
  processQuery(query);
});

console.log('\n📊 Summary:');
console.log('The fix ensures that webSearchMode is reset after each query,');
console.log('allowing intelligent search decision logic to work for subsequent queries.');