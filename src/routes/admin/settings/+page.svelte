<script lang="ts">
  import { onMount } from 'svelte';
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { toast } from "svelte-sonner";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
  } from "$lib/components/ui/card";
  import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "$lib/components/ui/select";
  
  import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "$lib/components/ui/dialog";
  import { Label } from "$lib/components/ui/label";

  function showToast({ title, description, type = "default" }) {
    if (type === "error") {
      toast.error(description, { title });
    } else {
      toast.success(description, { title });
    }
  }

  // MCP服务器管理状态
  let mcpServers: Array<{
    id: string;
    name: string;
    transport: string;
    command?: string;
    baseUrl?: string;
    isActive: boolean;
    hasApiKey: boolean;
    createdAt: string;
  }> = [];
  let showMcpForm = false;
  let editingMcpServer: any = null;
  let isLoadingMcp = false;

  // MCP表单数据
  let mcpFormData = {
    name: '',
    transport: 'http' as 'stdio' | 'http' | 'websocket',
    command: '',
    baseUrl: '',
    apiKey: '',
    config: ''
  };

  // 原有的providers和models状态
  let providers = [];
  let models = [];
  let selectedProviderId = null;
  let activeTab = 'mcp'; // 默认显示MCP标签页
  let discoveredModelsForProvider = [];
  let showCustomModelForm = false;
  let showDiscoveredModelsDialog = false;
  let currentProviderForDiscovery = null;
  let selectedDiscoveredProvider = null;
  let isTestingKey = false;
  let isTestingProviderKey = false;
  let isEditing = false;
  let editingProviderId = null;
  let showApiKey = false;

  $: filteredModels = selectedProviderId
    ? models.filter(m => m.providerId === selectedProviderId)
    : models;

  $: groupedDiscoveredModels = (discoveredModelsForProvider.length > 30 && currentProviderForDiscovery?.type === 'openai' && currentProviderForDiscovery?.baseUrl.includes('openrouter'))
    ? discoveredModelsForProvider.reduce((acc, model) => {
        const providerName = model.id.split('/')[0];
        if (!acc[providerName]) {
          acc[providerName] = [];
        }
        acc[providerName].push(model);
        return acc;
      }, {})
    : null;

  $: if (showDiscoveredModelsDialog && groupedDiscoveredModels && !selectedDiscoveredProvider) {
    selectedDiscoveredProvider = Object.keys(groupedDiscoveredModels)[0];
  }

  onMount(async () => {
    if ($page.data.user?.role !== 'admin') {
      goto('/chat');
      toast.error("You don't have permission to access admin settings", {
        title: "Access Denied"
      });
    } else {
      loadProviders();
      loadModels();
      loadMcpServers(); // 加载MCP服务器
    }
  });

  // MCP服务器相关函数
  async function loadMcpServers() {
    try {
      const response = await fetch('/api/mcp-server?includeInactive=true');
      if (response.ok) {
        const result = await response.json();
        mcpServers = result.data;
      } else {
        toast.error('Failed to load MCP servers');
      }
    } catch (error) {
      toast.error('Error loading MCP servers');
      console.error('Error loading MCP servers:', error);
    }
  }

  function resetMcpForm() {
    mcpFormData = {
      name: '',
      transport: 'http',
      command: '',
      baseUrl: '',
      apiKey: '',
      config: ''
    };
    editingMcpServer = null;
    showMcpForm = false;
  }

  function startEditMcpServer(server: any) {
    editingMcpServer = server;
    mcpFormData = {
      name: server.name,
      transport: server.transport,
      command: server.command || '',
      baseUrl: server.baseUrl || '',
      apiKey: '', // 不显示现有API密钥
      config: server.config ? JSON.stringify(server.config, null, 2) : ''
    };
    showMcpForm = true;
  }

  async function handleDeleteMcpServer(server: any) {
    if (!confirm(`Are you sure you want to delete "${server.name}"? This action cannot be undone.`)) {
      return;
    }

    isLoadingMcp = true;
    
    try {
      const response = await fetch(`/api/mcp-server/${server.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast.success('MCP server deleted successfully');
        await loadMcpServers();
      } else {
        const result = await response.json();
        toast.error(result.error?.message || 'Delete failed');
      }
    } catch (error) {
      toast.error('Network error occurred');
      console.error('Error deleting MCP server:', error);
    } finally {
      isLoadingMcp = false;
    }
  }

  async function handleActivateMcpServer(server: any) {
    if (server.isActive) return;
    
    if (!confirm(`Activate MCP server "${server.name}"? This will deactivate the current active server.`)) {
      return;
    }

    isLoadingMcp = true;
    
    try {
      const response = await fetch(`/api/mcp-server/${server.id}/activate`, {
        method: 'POST'
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(`MCP server "${server.name}" activated successfully`);
        await loadMcpServers();
      } else {
        toast.error(result.error?.message || 'Activation failed');
      }
    } catch (error) {
      toast.error('Network error occurred');
      console.error('Error activating MCP server:', error);
    } finally {
      isLoadingMcp = false;
    }
  }

  async function handleSubmitMcpForm() {
    if (!mcpFormData.name.trim()) {
      toast.error('Server name is required');
      return;
    }

    if (mcpFormData.transport === 'stdio' && !mcpFormData.command.trim()) {
      toast.error('Command is required for stdio transport');
      return;
    }

    if (mcpFormData.transport !== 'stdio' && !mcpFormData.baseUrl.trim()) {
      toast.error('Base URL is required for HTTP/WebSocket transport');
      return;
    }

    isLoadingMcp = true;

    try {
      const payload = {
        name: mcpFormData.name.trim(),
        transport: mcpFormData.transport,
        ...(mcpFormData.transport === 'stdio' 
          ? { command: mcpFormData.command.trim() }
          : { baseUrl: mcpFormData.baseUrl.trim() }
        ),
        ...(mcpFormData.apiKey.trim() && { apiKey: mcpFormData.apiKey.trim() }),
        ...(mcpFormData.config.trim() && { config: JSON.parse(mcpFormData.config) })
      };

      const url = editingMcpServer 
        ? `/api/mcp-server/${editingMcpServer.id}` 
        : '/api/mcp-server';
      
      const method = editingMcpServer ? 'PATCH' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(editingMcpServer ? 'MCP server updated successfully' : 'MCP server created successfully');
        resetMcpForm();
        await loadMcpServers();
      } else {
        toast.error(result.error?.message || 'Operation failed');
      }
    } catch (error) {
      toast.error('Network error occurred');
      console.error('Error submitting MCP form:', error);
    } finally {
      isLoadingMcp = false;
    }
  }

  async function testMcpConnection(server: any) {
    try {
      const response = await fetch('/api/mcp-server/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId: server.id })
      });

      const result = await response.json();

      if (result.success) {
        if (result.data.success) {
          toast.success('Connection test successful');
        } else {
          toast.warning(`Connection test failed: ${result.data.message}`);
        }
      } else {
        toast.error(result.error?.message || 'Test failed');
      }
    } catch (error) {
      toast.error('Network error occurred');
      console.error('Error testing MCP connection:', error);
    }
  }

  // 监听传输类型变化，清空不相关的字段
  $: if (mcpFormData.transport === 'stdio') {
    mcpFormData.baseUrl = '';
  } else {
    mcpFormData.command = '';
  }

  // 原有的providers和models相关函数（简化版本）
  async function loadProviders() {
    try {
      const response = await fetch('/api/providers');
      if (response.ok) {
        providers = await response.json();
        await loadModels();
      }
    } catch (err) {
      console.error('Error loading providers:', err);
    }
  }

  async function loadModels() {
    try {
      const response = await fetch('/api/models/all');
      if (response.ok) {
        models = await response.json();
      }
    } catch (err) {
      console.error('Error loading models:', err);
    }
  }

</script>

<div class="max-w-5xl mx-auto px-4 py-8 h-full overflow-y-auto">
  <div class="mb-8">
    <h1 class="text-2xl font-bold mb-2">Admin Settings</h1>
    <p class="text-gray-600">Manage LLM providers, models, and MCP servers</p>
  </div>

  <div class="flex border-b mb-6">
    <button 
      class="px-4 py-2 -mb-px border-b-2 font-medium text-sm focus:outline-none "
      class:border-blue-500={activeTab === 'mcp'}
      class:text-blue-600={activeTab === 'mcp'}
      class:border-transparent={activeTab !== 'mcp'}
      class:hover:text-gray-700={activeTab !== 'mcp'}
      on:click={() => activeTab = 'mcp'}
    >
      MCP Servers
    </button>
    <button 
      class="px-4 py-2 -mb-px border-b-2 font-medium text-sm focus:outline-none"
      class:border-blue-500={activeTab === 'providers'}
      class:text-blue-600={activeTab === 'providers'}
      class:border-transparent={activeTab !== 'providers'}
      class:hover:text-gray-700={activeTab !== 'providers'}
      on:click={() => activeTab = 'providers'}
    >
      Providers
    </button>
    <button 
      class="px-4 py-2 -mb-px border-b-2 font-medium text-sm focus:outline-none"
      class:border-blue-500={activeTab === 'models'}
      class:text-blue-600={activeTab === 'models'}
      class:border-transparent={activeTab !== 'models'}
      class:hover:text-gray-700={activeTab !== 'models'}
      on:click={() => activeTab = 'models'}
    >
      Model Management
    </button>
  </div>

  <!-- MCP Servers Tab -->
  {#if activeTab === 'mcp'}
    <div class="space-y-6">
      <div class="flex justify-between items-center">
        <div>
          <h2 class="text-2xl font-bold">MCP Server Management</h2>
          <p class="text-gray-600">Configure and manage MCP servers for AI tool integration</p>
        </div>
        <Button on:click={() => showMcpForm = true}>
          Add MCP Server
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configured Servers</CardTitle>
          <CardDescription>Manage your MCP server configurations</CardDescription>
        </CardHeader>
        <CardContent>
          {#if mcpServers.length > 0}
            <div class="space-y-4">
              {#each mcpServers as server (server.id)}
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
                        on:click={() => handleActivateMcpServer(server)}
                        disabled={isLoadingMcp}
                      >
                        Activate
                      </Button>
                    {/if}
                    <Button 
                      size="sm" 
                      variant="outline"
                      on:click={() => testMcpConnection(server)}
                      disabled={isLoadingMcp}
                    >
                      Test
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      on:click={() => startEditMcpServer(server)}
                      disabled={isLoadingMcp}
                    >
                      Edit
                    </Button>
                    <Button 
                      size="sm" 
                      variant="destructive"
                      on:click={() => handleDeleteMcpServer(server)}
                      disabled={isLoadingMcp}
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

    <!-- MCP Form Dialog -->
    {#if showMcpForm}
      <Dialog open={showMcpForm} on:openChange={(open) => !open && resetMcpForm()}>
        <DialogContent class="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingMcpServer ? 'Edit MCP Server' : 'Add MCP Server'}</DialogTitle>
            <DialogDescription>
              {editingMcpServer ? 'Update the MCP server configuration' : 'Configure a new MCP server for AI tool integration'}
            </DialogDescription>
          </DialogHeader>

          <form on:submit|preventDefault={handleSubmitMcpForm} class="space-y-4">
            <div>
              <Label for="mcp-name">Server Name *</Label>
              <Input 
                id="mcp-name" 
                bind:value={mcpFormData.name} 
                placeholder="My MCP Server"
                required
              />
            </div>

            <div>
              <Label for="mcp-transport">Transport Type *</Label>
              <Select bind:value={mcpFormData.transport}>
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

            {#if mcpFormData.transport === 'stdio'}
              <div>
                <Label for="mcp-command">Command *</Label>
                <Input 
                  id="mcp-command" 
                  bind:value={mcpFormData.command} 
                  placeholder="python /path/to/mcp_server.py"
                  required
                />
                <p class="text-xs text-gray-500 mt-1">
                  The command to start the MCP server process
                </p>
              </div>
            {:else}
              <div>
                <Label for="mcp-baseUrl">Base URL *</Label>
                <Input 
                  id="mcp-baseUrl" 
                  bind:value={mcpFormData.baseUrl} 
                  placeholder="http://localhost:33333"
                  required
                />
                <p class="text-xs text-gray-500 mt-1">
                  {mcpFormData.transport === 'websocket' ? 'WebSocket URL (ws:// or wss://)' : 'HTTP endpoint URL'}
                </p>
              </div>
            {/if}

            <div>
              <Label for="mcp-apiKey">API Key (Optional)</Label>
              <Input 
                id="mcp-apiKey" 
                bind:value={mcpFormData.apiKey} 
                placeholder="sk-..."
                type="password"
              />
              <p class="text-xs text-gray-500 mt-1">
                Optional API key for authentication (leave empty to keep existing key)
              </p>
            </div>

            <div>
              <Label for="mcp-config">Tool Configuration (Optional)</Label>
              <textarea 
                id="mcp-config" 
                bind:value={mcpFormData.config} 
                placeholder="JSON configuration for MCP tools (optional)"
                rows={6}
                class="font-mono text-sm w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              ></textarea>
              <p class="text-xs text-gray-500 mt-1">
                JSON configuration for available tools (optional)
              </p>
            </div>
          </form>

          <DialogFooter>
            <Button 
              variant="outline" 
              on:click={resetMcpForm}
              disabled={isLoadingMcp}
            >
              Cancel
            </Button>
            <Button 
              on:click={handleSubmitMcpForm}
              disabled={isLoadingMcp}
            >
              {isLoadingMcp ? 'Saving...' : (editingMcpServer ? 'Update' : 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    {/if}
  {:else if activeTab === 'providers'}
    <!-- 原有的Providers界面代码（简化版） -->
    <Card>
      <CardHeader>
        <CardTitle>AI Providers</CardTitle>
        <CardDescription>Configure AI service providers</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="space-y-4">
          {#if providers.length > 0}
            <div class="grid gap-4 max-h-[400px] overflow-y-auto pr-2">
              {#each providers as provider}
                <div class="border rounded-md p-4 flex justify-between items-center">
                  <div>
                    <h3 class="font-medium">{provider.name}</h3>
                    <p class="text-sm text-gray-500">
                      Type: {provider.type}
                      {#if provider.isCustom}
                        (Custom)
                      {/if}
                    </p>
                    {#if provider.baseUrl}
                      <p class="text-xs text-gray-400">{provider.baseUrl}</p>
                    {/if}
                  </div>
                  <div class="flex gap-2">
                    <Button variant="outline" size="sm">
                      Modify
                    </Button>
                    <Button variant="destructive" size="sm">
                      Delete
                    </Button>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <p class="text-center text-gray-500 py-4">No providers configured yet</p>
          {/if}
          <Button class="w-full">Add Provider</Button>
        </div>
      </CardContent>
    </Card>
  {:else if activeTab === 'models'}
    <!-- 原有的Models界面代码（简化版） -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div class="md:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle>Providers</CardTitle>
            <CardDescription>Select a provider</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="space-y-2">
              <Button 
                variant={!selectedProviderId ? 'secondary' : 'ghost'} 
                class="w-full justify-start" 
                on:click={() => selectedProviderId = null}
              >
                All Models
              </Button>
              {#each providers as provider (provider.id)}
                <Button 
                  variant={selectedProviderId === provider.id ? 'secondary' : 'ghost'} 
                  class="w-full justify-start" 
                  on:click={() => selectedProviderId = provider.id}
                >
                  {provider.name}
                </Button>
              {/each}
            </div>
          </CardContent>
        </Card>
      </div>

      <div class="md:col-span-3">
        <Card>
          <CardHeader class="flex flex-row items-center justify-between">
            <div class="space-y-1">
              <CardTitle>Models</CardTitle>
              <CardDescription>
                {#if selectedProviderId}
                  Models for {providers.find(p => p.id === selectedProviderId)?.name || 'selected provider'}
                {:else}
                  All configured models
                {/if}
              </CardDescription>
            </div>
            {#if selectedProviderId}
              <Button disabled={isTestingKey}>
                {#if isTestingKey}
                  <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Updating...
                {:else}
                  Update
                {/if}
              </Button>
            {/if}
          </CardHeader>
          <CardContent>
            <div class="space-y-4">
              {#if filteredModels.length > 0}
                <div class="grid gap-4 pr-2">
                  {#each filteredModels as model (model.id)}
                    <div class="border rounded-md p-4 flex justify-between items-center">
                      <div>
                        <h3 class="font-medium">{model.name}</h3>
                        <p class="text-sm text-gray-500">{model.model}</p>
                        <p class="text-xs text-gray-400">Provider: {model.provider?.name || 'N/A'}</p>
                      </div>
                      <div class="flex gap-2">
                        <Button variant="destructive" size="sm">
                          Delete
                        </Button>
                      </div>
                    </div>
                  {/each}
                </div>
              {:else if !selectedProviderId}
                 <p class="text-center text-gray-500 py-4">Select a provider to see its models.</p>
              {:else}
                <p class="text-center text-gray-500 py-4">No models configured for this provider.</p>
              {/if}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  {/if}
</div>