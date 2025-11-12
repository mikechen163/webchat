<!-- MCP服务器管理组件 -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '$lib/components/ui/select';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';

  import { toast } from 'svelte-sonner';
  import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
  import { Label } from '$lib/components/ui/label';
  import { Textarea } from '$lib/components/ui/textarea';

  interface McpServer {
    id: string;
    name: string;
    transport: 'stdio' | 'http' | 'websocket';
    command?: string;
    baseUrl?: string;
    isActive: boolean;
    hasApiKey: boolean;
    createdAt: string;
    config?: any;
  }

  let servers: McpServer[] = [];
  let showForm = false;
  let editingServer: McpServer | null = null;
  let isLoading = false;
  let showDeleteConfirm = false;
  let serverToDelete: McpServer | null = null;
  let showActivateConfirm = false;
  let serverToActivate: McpServer | null = null;

  // 表单数据
  let formData = {
    name: '',
    transport: 'http' as 'stdio' | 'http' | 'websocket',
    command: '',
    baseUrl: '',
    apiKey: '',
    config: ''
  };

  onMount(async () => {
    await loadServers();
  });

  async function loadServers() {
    try {
      const response = await fetch('/api/mcp-server?includeInactive=true');
      if (response.ok) {
        const result = await response.json();
        servers = result.data;
      } else {
        toast.error('Failed to load MCP servers');
      }
    } catch (error) {
      toast.error('Error loading MCP servers');
      console.error('Error loading servers:', error);
    }
  }

  function resetForm() {
    formData = {
      name: '',
      transport: 'http',
      command: '',
      baseUrl: '',
      apiKey: '',
      config: ''
    };
    editingServer = null;
    showForm = false;
  }

  function startEdit(server: McpServer) {
    editingServer = server;
    formData = {
      name: server.name,
      transport: server.transport,
      command: server.command || '',
      baseUrl: server.baseUrl || '',
      apiKey: '', // 不显示现有API密钥
      config: server.config ? JSON.stringify(server.config, null, 2) : ''
    };
    showForm = true;
  }

  function startDelete(server: McpServer) {
    serverToDelete = server;
    showDeleteConfirm = true;
  }

  function startActivate(server: McpServer) {
    if (server.isActive) return;
    serverToActivate = server;
    showActivateConfirm = true;
  }

  async function handleSubmit() {
    if (!formData.name.trim()) {
      toast.error('Server name is required');
      return;
    }

    if (formData.transport === 'stdio' && !formData.command.trim()) {
      toast.error('Command is required for stdio transport');
      return;
    }

    if (formData.transport !== 'stdio' && !formData.baseUrl.trim()) {
      toast.error('Base URL is required for HTTP/WebSocket transport');
      return;
    }

    isLoading = true;

    try {
      const payload = {
        name: formData.name.trim(),
        transport: formData.transport,
        ...(formData.transport === 'stdio' 
          ? { command: formData.command.trim() }
          : { baseUrl: formData.baseUrl.trim() }
        ),
        ...(formData.apiKey.trim() && { apiKey: formData.apiKey.trim() }),
        ...(formData.config.trim() && { config: JSON.parse(formData.config) })
      };

      const url = editingServer 
        ? `/api/mcp-server/${editingServer.id}` 
        : '/api/mcp-server';
      
      const method = editingServer ? 'PATCH' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(editingServer ? 'Server updated successfully' : 'Server created successfully');
        resetForm();
        await loadServers();
      } else {
        toast.error(result.error?.message || 'Operation failed');
      }
    } catch (error) {
      toast.error('Network error occurred');
      console.error('Error submitting form:', error);
    } finally {
      isLoading = false;
    }
  }

  async function handleDelete() {
    if (!serverToDelete) return;

    isLoading = true;
    
    try {
      const response = await fetch(`/api/mcp-server/${serverToDelete.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast.success('Server deleted successfully');
        await loadServers();
      } else {
        const result = await response.json();
        toast.error(result.error?.message || 'Delete failed');
      }
    } catch (error) {
      toast.error('Network error occurred');
      console.error('Error deleting server:', error);
    } finally {
      isLoading = false;
      showDeleteConfirm = false;
      serverToDelete = null;
    }
  }

  async function handleActivate() {
    if (!serverToActivate) return;

    isLoading = true;
    
    try {
      const response = await fetch(`/api/mcp-server/${serverToActivate.id}/activate`, {
        method: 'POST'
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(`Server "${serverToActivate.name}" activated successfully`);
        await loadServers();
      } else {
        toast.error(result.error?.message || 'Activation failed');
      }
    } catch (error) {
      toast.error('Network error occurred');
      console.error('Error activating server:', error);
    } finally {
      isLoading = false;
      showActivateConfirm = false;
      serverToActivate = null;
    }
  }

  async function testConnection(server: McpServer) {
    console.log('[McpServerManager] 开始测试连接:', server.name, '传输方式:', server.transport);
    try {
      const response = await fetch('/api/mcp-server/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId: server.id })
      });

      const result = await response.json();
      console.log('[McpServerManager] 测试结果:', result);

      if (result.success) {
        if (result.data.success) {
          toast.success('Connection test successful');
          console.log('[McpServerManager] 连接测试成功');
        } else {
          toast.warning(`Connection test failed: ${result.data.message}`);
          console.log('[McpServerManager] 连接测试失败:', result.data.message);
        }
      } else {
        toast.error(result.error?.message || 'Test failed');
        console.log('[McpServerManager] 测试错误:', result.error);
      }
    } catch (error) {
      toast.error('Network error occurred');
      console.error('[McpServerManager] 网络错误:', error);
    }
  }

  // 监听传输类型变化，清空不相关的字段
  $: if (formData.transport === 'stdio') {
    formData.baseUrl = '';
  } else {
    formData.command = '';
  }
</script>

<div class="space-y-6">
  <!-- 头部 -->
  <div class="flex justify-between items-center">
    <div>
      <h2 class="text-2xl font-bold">MCP Server Management</h2>
      <p class="text-gray-600">Configure and manage MCP servers for AI tool integration</p>
    </div>
    <Button on:click={() => showForm = true}>
      Add MCP Server
    </Button>
  </div>

  <!-- 服务器列表 -->
  <Card>
    <CardHeader>
      <CardTitle>Configured Servers</CardTitle>
      <CardDescription>Manage your MCP server configurations</CardDescription>
    </CardHeader>
    <CardContent>
      {#if servers.length > 0}
        <div class="space-y-4">
          {#each servers as server (server.id)}
            <div class="border rounded-lg p-4 flex justify-between items-start">
              <div class="space-y-1 flex-1">
                <div class="flex items-center gap-2">
                  <h3 class="font-semibold">{server.name}</h3>
                  {#if server.isActive}
                    <span class="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">Active</span>
                  {:else}
                    <span class="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded-full">Inactive</span>
                  {/if}
                </div>
                <p class="text-sm text-gray-600">
                  {server.transport.toUpperCase()}
                  {#if server.transport === 'stdio'}
                    - {server.command}
                  {:else}
                    - {server.baseUrl}
                  {/if}
                </p>
                {#if server.hasApiKey}
                  <p class="text-xs text-gray-500">Has API Key</p>
                {/if}
                <p class="text-xs text-gray-400">Created: {new Date(server.createdAt).toLocaleDateString()}</p>
              </div>
              <div class="flex gap-2">
                {#if !server.isActive}
                  <Button 
                    size="sm" 
                    variant="outline"
                    on:click={() => startActivate(server)}
                  >
                    Activate
                  </Button>
                {/if}
                <Button 
                  size="sm" 
                  variant="outline"
                  on:click={() => testConnection(server)}
                >
                  Test
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  on:click={() => startEdit(server)}
                >
                  Edit
                </Button>
                <Button 
                  size="sm" 
                  variant="destructive"
                  on:click={() => startDelete(server)}
                >
                  Delete
                </Button>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <p class="text-center text-gray-500 py-8">No MCP servers configured yet</p>
      {/if}
    </CardContent>
  </Card>
</div>

<!-- 添加/编辑服务器对话框 -->
{#if showForm}
  <Dialog open={showForm} on:openChange={(open) => !open && resetForm()}>
    <DialogContent class="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{editingServer ? 'Edit MCP Server' : 'Add MCP Server'}</DialogTitle>
        <DialogDescription>
          {editingServer ? 'Update the MCP server configuration' : 'Configure a new MCP server for AI tool integration'}
        </DialogDescription>
      </DialogHeader>

      <form on:submit|preventDefault={handleSubmit} class="space-y-4">
        <div>
          <Label for="name">Server Name *</Label>
          <Input 
            id="name" 
            bind:value={formData.name} 
            placeholder="My MCP Server"
            required
          />
        </div>

        <div>
          <Label for="transport">Transport Type *</Label>
          <Select bind:value={formData.transport}>
            <SelectTrigger>
              <SelectValue placeholder="Select transport type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="http">HTTP</SelectItem>
              <SelectItem value="websocket">WebSocket</SelectItem>
              <SelectItem value="stdio">Stdio</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {#if formData.transport === 'stdio'}
          <div>
            <Label for="command">Command *</Label>
            <Input 
              id="command" 
              bind:value={formData.command} 
              placeholder="python /path/to/mcp_server.py"
              required
            />
            <p class="text-xs text-gray-500 mt-1">
              The command to start the MCP server process
            </p>
          </div>
        {:else}
          <div>
            <Label for="baseUrl">Base URL *</Label>
            <Input 
              id="baseUrl" 
              bind:value={formData.baseUrl} 
              placeholder="http://localhost:33333"
              required
            />
            <p class="text-xs text-gray-500 mt-1">
              {formData.transport === 'websocket' ? 'WebSocket URL (ws:// or wss://)' : 'HTTP endpoint URL'}
            </p>
          </div>
        {/if}

        <div>
          <Label for="apiKey">API Key (Optional)</Label>
          <Input 
            id="apiKey" 
            bind:value={formData.apiKey} 
            placeholder="sk-..."
            type="password"
          />
          <p class="text-xs text-gray-500 mt-1">
            Optional API key for authentication (leave empty to keep existing key)
          </p>
        </div>

        <div>
          <Label for="config">Tool Configuration (Optional)</Label>
          <Textarea 
            id="config" 
            bind:value={formData.config} 
            placeholder='{"tools": [{"name": "execute_python", "description": "Execute Python code", "inputSchema": {"type": "object", "properties": {"code": {"type": "string"}}}}]}'
            rows={6}
            class="font-mono text-sm"
          />
          <p class="text-xs text-gray-500 mt-1">
            JSON configuration for available tools (optional)
          </p>
        </div>
      </form>

      <DialogFooter>
        <Button 
          variant="outline" 
          on:click={resetForm}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button 
          on:click={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? 'Saving...' : (editingServer ? 'Update' : 'Create')}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
{/if}

<!-- 删除确认对话框 -->
{#if showDeleteConfirm}
  <Dialog open={showDeleteConfirm} on:openChange={(open) => !open && (serverToDelete = null)}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Delete MCP Server</DialogTitle>
        <DialogDescription>
          Are you sure you want to delete "{serverToDelete?.name}"? This action cannot be undone.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button 
          variant="outline" 
          on:click={() => { showDeleteConfirm = false; serverToDelete = null; }}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button 
          variant="destructive" 
          on:click={handleDelete}
          disabled={isLoading}
        >
          {isLoading ? 'Deleting...' : 'Delete'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
{/if}

<!-- 激活确认对话框 -->
{#if showActivateConfirm}
  <Dialog open={showActivateConfirm} on:openChange={(open) => !open && (serverToActivate = null)}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Activate MCP Server</DialogTitle>
        <DialogDescription>
          Are you sure you want to activate "{serverToActivate?.name}"? This will deactivate the currently active server.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button 
          variant="outline" 
          on:click={() => { showActivateConfirm = false; serverToActivate = null; }}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button 
          on:click={handleActivate}
          disabled={isLoading}
        >
          {isLoading ? 'Activating...' : 'Activate'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
{/if}