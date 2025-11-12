#!/usr/bin/env node

/**
 * Debug chat API issues
 */

import fetch from 'node-fetch';

const CHAT_API_URL = 'http://localhost:3001/api/chat/test-session-id';

async function debugChatAPI() {
  console.log('🔍 Debugging Chat API\n');
  
  // Test 1: Basic chat without any special flags
  console.log('1. Testing basic chat API...');
  try {
    const response = await fetch(CHAT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: "Hello, how are you?",
        modelId: 'cm7ppw90a0001qxxebu39jwld', // Use a valid model ID from the /api/models response
        temperature: 0.7,
        max_tokens: 100
      })
    });

    console.log(`Status: ${response.status}`);
    console.log(`Status Text: ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`Error Response: ${errorText}`);
    } else {
      const reader = response.body.getReader();
      let result = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += new TextDecoder().decode(value);
      }
      console.log(`Success Response: ${result.substring(0, 200)}...`);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }

  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 2: With intelligent search flag
  console.log('\n2. Testing with intelligent search flag...');
  try {
    const response = await fetch(CHAT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: "What's the current price of Bitcoin?",
        modelId: 'cm7ppw90a0001qxxebu39jwld',
        temperature: 0.3,
        max_tokens: 500,
        enableIntelligentSearch: true
      })
    });

    console.log(`Status: ${response.status}`);
    console.log(`Status Text: ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`Error Response: ${errorText}`);
    } else {
      const reader = response.body.getReader();
      let result = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += new TextDecoder().decode(value);
      }
      console.log(`Success Response: ${result.substring(0, 200)}...`);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }

  // Test 3: Check if session exists
  console.log('\n3. Testing GET request to check session...');
  try {
    const response = await fetch(CHAT_API_URL, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    console.log(`Status: ${response.status}`);
    console.log(`Status Text: ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`Error Response: ${errorText}`);
    } else {
      const data = await response.json();
      console.log(`Session Data:`, JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

// Run debug
console.log('🚀 Starting Chat API Debug\n');
debugChatAPI().catch(console.error);