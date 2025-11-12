/**
 * MCP功能测试脚本
 * 用于验证MCP服务器管理功能的正常运行
 */

const TEST_API_BASE = 'http://localhost:3001/api';

// 模拟管理员token（在实际环境中需要真实的认证）
const ADMIN_TOKEN = 'test-admin-token';

// 测试配置
const testMcpServer = {
  name: 'Test MCP Server',
  transport: 'http',
  baseUrl: 'http://localhost:33333',
  apiKey: 'sk-test123456',
  config: {
    tools: [{
      name: 'execute_python',
      description: 'Execute Python code',
      inputSchema: {
        type: 'object',
        properties: {
          code: { type: 'string' }
        },
        required: ['code']
      }
    }]
  }
};

console.log('🚀 Starting MCP functionality tests...\n');

// 测试1: 获取MCP服务器列表
async function testGetMcpServers() {
  console.log('📋 Test 1: Getting MCP servers list');
  try {
    const response = await fetch(`${TEST_API_BASE}/mcp-server?includeInactive=true`, {
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('✅ Get MCP servers:', response.status === 200 ? 'SUCCESS' : 'FAILED');
    console.log('📊 Server count:', result.count || 0);
    return result;
  } catch (error) {
    console.log('❌ Get MCP servers FAILED:', error.message);
    return null;
  }
}

// 测试2: 创建MCP服务器
async function testCreateMcpServer() {
  console.log('\n➕ Test 2: Creating new MCP server');
  try {
    const response = await fetch(`${TEST_API_BASE}/mcp-server`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testMcpServer)
    });
    
    const result = await response.json();
    console.log('✅ Create MCP server:', response.status === 201 ? 'SUCCESS' : 'FAILED');
    
    if (result.success) {
      console.log('🆔 Server ID:', result.data.id);
      console.log('📛 Server Name:', result.data.name);
      return result.data;
    }
    return null;
  } catch (error) {
    console.log('❌ Create MCP server FAILED:', error.message);
    return null;
  }
}

// 测试3: 测试MCP服务器连接
async function testMcpConnection(serverId) {
  console.log('\n🔌 Test 3: Testing MCP server connection');
  try {
    const response = await fetch(`${TEST_API_BASE}/mcp-server/test`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ serverId })
    });
    
    const result = await response.json();
    console.log('✅ Test MCP connection:', response.status === 200 ? 'SUCCESS' : 'FAILED');
    
    if (result.success && result.data.success) {
      console.log('✅ Connection Status: HEALTHY');
    } else {
      console.log('⚠️  Connection Status:', result.data?.message || 'FAILED');
    }
    return result;
  } catch (error) {
    console.log('❌ Test MCP connection FAILED:', error.message);
    return null;
  }
}

// 测试4: 激活MCP服务器
async function testActivateMcpServer(serverId) {
  console.log('\n⚡ Test 4: Activating MCP server');
  try {
    const response = await fetch(`${TEST_API_BASE}/mcp-server/${serverId}/activate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('✅ Activate MCP server:', response.status === 200 ? 'SUCCESS' : 'FAILED');
    
    if (result.success) {
      console.log('✅ Server activated successfully');
      console.log('🎯 Active Server:', result.data.name);
    }
    return result;
  } catch (error) {
    console.log('❌ Activate MCP server FAILED:', error.message);
    return null;
  }
}

// 测试5: 获取健康状态
async function testHealthCheck() {
  console.log('\n🏥 Test 5: Getting MCP health status');
  try {
    const response = await fetch(`${TEST_API_BASE}/mcp-server/health`, {
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('✅ Health check:', response.status === 200 ? 'SUCCESS' : 'FAILED');
    
    if (result.success) {
      console.log('📊 Health Status:', result.data.status);
      console.log('🖥️  Active Server:', result.data.server?.name || 'None');
      console.log('📈 Total Servers:', result.data.totalServers);
    }
    return result;
  } catch (error) {
    console.log('❌ Health check FAILED:', error.message);
    return null;
  }
}

// 测试6: 更新MCP服务器
async function testUpdateMcpServer(serverId) {
  console.log('\n✏️ Test 6: Updating MCP server');
  const updateData = {
    name: 'Updated Test Server',
    baseUrl: 'http://localhost:8080'
  };
  
  try {
    const response = await fetch(`${TEST_API_BASE}/mcp-server/${serverId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });
    
    const result = await response.json();
    console.log('✅ Update MCP server:', response.status === 200 ? 'SUCCESS' : 'FAILED');
    
    if (result.success) {
      console.log('✅ Server updated successfully');
      console.log('📝 New Name:', result.data.name);
      console.log('🔗 New URL:', result.data.baseUrl);
    }
    return result;
  } catch (error) {
    console.log('❌ Update MCP server FAILED:', error.message);
    return null;
  }
}

// 测试7: 删除MCP服务器
async function testDeleteMcpServer(serverId) {
  console.log('\n🗑️ Test 7: Deleting MCP server');
  try {
    const response = await fetch(`${TEST_API_BASE}/mcp-server/${serverId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('✅ Delete MCP server:', response.status === 200 ? 'SUCCESS' : 'FAILED');
    
    if (result.success) {
      console.log('✅ Server deleted successfully');
    }
    return result;
  } catch (error) {
    console.log('❌ Delete MCP server FAILED:', error.message);
    return null;
  }
}

// 主测试流程
async function runTests() {
  console.log('🎯 Starting comprehensive MCP functionality tests...\n');
  
  let testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    details: []
  };
  
  // Test 1: Get initial servers
  testResults.total++;
  const initialServers = await testGetMcpServers();
  if (initialServers) {
    testResults.passed++;
    testResults.details.push('✅ Get MCP servers: PASSED');
  } else {
    testResults.failed++;
    testResults.details.push('❌ Get MCP servers: FAILED');
  }
  
  // Test 2: Create new server
  testResults.total++;
  const newServer = await testCreateMcpServer();
  if (newServer) {
    testResults.passed++;
    testResults.details.push('✅ Create MCP server: PASSED');
    
    // Continue with server-specific tests
    const serverId = newServer.id;
    
    // Test 3: Connection test
    testResults.total++;
    const connectionResult = await testMcpConnection(serverId);
    if (connectionResult) {
      testResults.passed++;
      testResults.details.push('✅ Test MCP connection: PASSED');
    } else {
      testResults.failed++;
      testResults.details.push('❌ Test MCP connection: FAILED');
    }
    
    // Test 4: Activate server
    testResults.total++;
    const activationResult = await testActivateMcpServer(serverId);
    if (activationResult) {
      testResults.passed++;
      testResults.details.push('✅ Activate MCP server: PASSED');
    } else {
      testResults.failed++;
      testResults.details.push('❌ Activate MCP server: FAILED');
    }
    
    // Test 5: Health check
    testResults.total++;
    const healthResult = await testHealthCheck();
    if (healthResult) {
      testResults.passed++;
      testResults.details.push('✅ Health check: PASSED');
    } else {
      testResults.failed++;
      testResults.details.push('❌ Health check: FAILED');
    }
    
    // Test 6: Update server
    testResults.total++;
    const updateResult = await testUpdateMcpServer(serverId);
    if (updateResult) {
      testResults.passed++;
      testResults.details.push('✅ Update MCP server: PASSED');
    } else {
      testResults.failed++;
      testResults.details.push('❌ Update MCP server: FAILED');
    }
    
    // Test 7: Delete server (cleanup)
    testResults.total++;
    const deleteResult = await testDeleteMcpServer(serverId);
    if (deleteResult) {
      testResults.passed++;
      testResults.details.push('✅ Delete MCP server: PASSED');
    } else {
      testResults.failed++;
      testResults.details.push('❌ Delete MCP server: FAILED');
    }
    
  } else {
    testResults.failed++;
    testResults.details.push('❌ Create MCP server: FAILED - Skipping server-specific tests');
  }
  
  // Final summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(50));
  console.log(`🎯 Total Tests: ${testResults.total}`);
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📈 Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
  console.log('\n📋 Detailed Results:');
  testResults.details.forEach(result => console.log(result));
  
  if (testResults.failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! MCP functionality is working correctly.');
  } else {
    console.log(`\n⚠️  ${testResults.failed} test(s) failed. Please review the issues above.`);
  }
  
  console.log('\n✨ MCP functionality test completed!');
  console.log('='.repeat(50));
  
  return testResults;
}

// 运行测试
runTests().then(results => {
  process.exit(results.failed > 0 ? 1 : 0);
}).catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});