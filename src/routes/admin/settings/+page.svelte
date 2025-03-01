<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { toast } from "$lib/components/ui/toast";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { onMount } from "svelte";
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
  
  import { Dialog as DialogPrimitive } from "bits-ui";

  onMount(() => {
    if ($page.data.user?.role !== 'admin') {
      goto('/chat');
      toast({
        title: "Access Denied",
        description: "You don't have permission to access admin settings",
        type: "error"
      });
    } else {
      loadProviders();
      loadModels();
    }
  });

  let apiKey = "";
  let modelSettings = {
    gpt35: { enabled: true, apiUrl: "https://api.openai.com/v1" },
    gpt4: { enabled: true, apiUrl: "https://api.openai.com/v1" }
  };
  let userLimit = 100;
  let maxRequestsPerDay = 50;

  async function saveSettings() {
    await new Promise(resolve => setTimeout(resolve, 800));
    toast({
      title: "Settings Saved",
      description: "Admin settings have been updated successfully",
      type: "success"
    });
  }

  let providers = [];
  let models = [];
  let isAddingProvider = false;
  let isTestingKey = false;
  let discoveredModels = [];
  let showProviderDialog = false;
  let showModelDialog = false;

  let newProvider = {
    name: "",
    type: "openai",
    baseUrl: "",
    apiKey: "",
    isCustom: false
  };

  let newModel = {
    name: "",
    baseUrl: "",
    apiKey: "",
    model: "",
    providerId: "",
    enabled: true
  };

  const providerTypes = [
    { value: "openai", label: "OpenAI" },
    { value: "gemini", label: "Google Gemini" },
    { value: "anthropic", label: "Anthropic" },
    { value: "custom", label: "Custom OpenAI Compatible" }
  ];

  async function loadProviders() {
    try {
      const response = await fetch('/api/providers');
      if (response.ok) {
        providers = await response.json();
      } else {
        toast({
          title: "Error",
          description: "Failed to load providers",
          type: "error"
        });
      }
    } catch (err) {
      console.error('Error loading providers:', err);
    }
  }

  async function loadModels() {
    try {
      const response = await fetch('/api/models');
      if (response.ok) {
        models = await response.json();
      } else {
        toast({
          title: "Error",
          description: "Failed to load models",
          type: "error"
        });
      }
    } catch (err) {
      console.error('Error loading models:', err);
    }
  }

  function sanitizeProviderData(provider) {
    return {
      name: provider.name?.trim() || '',
      type: provider.type === "custom" ? "openai" : (provider.type || "openai"),
      baseUrl: provider.type === "openai" ? "https://api.openai.com/v1" : 
              provider.type === "gemini" ? "https://generativelanguage.googleapis.com/v1beta" :
              provider.type === "anthropic" ? "https://api.anthropic.com/v1" :
              provider.baseUrl?.trim() || "",
      apiKey: typeof provider.apiKey === 'string' ? 
        provider.apiKey.replace(/TypeError:.*|Error:.*$/g, '').trim() : '',
      isCustom: provider.type === "custom"
    };
  }

  async function addProvider() {
    try {
      const providerData = sanitizeProviderData(newProvider);
      
      console.log("Sending provider data:", {
        ...providerData, 
        apiKey: providerData.apiKey ? '***' : undefined
      });
      
      const response = await fetch('/api/providers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(providerData)
      });

      if (response.ok) {
        const result = await response.json();
        providers = [...providers, result];
        resetProviderForm();
        toast({
          title: "Success",
          description: "Provider added successfully",
          variant: "default"
        });
      } else {
        const error = await response.json();
        throw new Error(error.message || "Failed to add provider");
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "An error occurred",
        variant: "destructive"
      });
    }
  }

  async function deleteProvider(id) {
    try {
      const response = await fetch(`/api/providers/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        providers = providers.filter(p => p.id !== id);
        toast({
          title: "Success",
          description: "Provider deleted successfully",
          type: "success"
        });
      } else {
        const error = await response.text();
        throw new Error(error || "Failed to delete provider");
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err.message || "An error occurred",
        type: "error"
      });
    }
  }

  async function testApiKey() {
    try {
      isTestingKey = true;
      const provider = providers.find(p => p.id === newModel.providerId);
      if (!provider) {
        throw new Error("Please select a provider first");
      }
      const response = await fetch('/api/providers/test-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          providerType: provider.type,
          apiKey: newModel.apiKey,
          baseUrl: newModel.baseUrl || provider.baseUrl
        })
      });
      const result = await response.json();

      if (result.success) {
        discoveredModels = result.models;
        toast({
          title: "Success",
          description: `API key valid! Found ${discoveredModels.length} models.`,
          type: "success"
        });
      } else {
        throw new Error(result.message || "API key validation failed");
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err.message || "Failed to validate API key",
        type: "error"
      });
      discoveredModels = [];
    } finally {
      isTestingKey = false;
    }
  }

  async function addModel() {
    try {
      const response = await fetch('/api/models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newModel)
      });
      if (response.ok) {
        const result = await response.json();
        models = [...models, result];
        resetModelForm();
        toast({
          title: "Success",
          description: "Model added successfully",
          type: "success"
        });
      } else {
        const error = await response.json();
        throw new Error(error.message || "Failed to add model");
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err.message || "An error occurred",
        type: "error"
      });
    }
  }

  async function toggleModelStatus(id, enabled) {
    try {
      const response = await fetch(`/api/models/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ enabled })
      });
      if (response.ok) {
        models = models.map(m => m.id === id ? { ...m, enabled } : m);
        toast({
          title: "Success",
          description: `Model ${enabled ? 'enabled' : 'disabled'} successfully`,
          type: "success"
        });
      } else {
        throw new Error("Failed to update model status");
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err.message || "An error occurred",
        type: "error"
      });
    }
  }

  async function deleteModel(id) {
    try {
      const response = await fetch(`/api/models/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        models = models.filter(m => m.id !== id);
        toast({
          title: "Success",
          description: "Model deleted successfully",
          type: "success"
        });
      } else {
        throw new Error("Failed to delete model");
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err.message || "An error occurred",
        type: "error"
      });
    }
  }

  function resetProviderForm() {
    newProvider = {
      name: "",
      type: "openai",
      baseUrl: "",
      apiKey: "",
      isCustom: false
    };
  }

  function resetModelForm() {
    newModel = {
      name: "",
      baseUrl: "",
      apiKey: "",
      model: "",
      providerId: "",
      enabled: true
    };
    discoveredModels = [];
  }

  function handleProviderTypeChange(event) {
    const type = event.detail;
    console.log("Provider type changed to:", type);
    newProvider.type = type;
    
    if (type === "openai") {
      newProvider.baseUrl = "https://api.openai.com/v1";
    } else if (type === "gemini") {
      newProvider.baseUrl = "https://generativelanguage.googleapis.com/v1beta";
    } else if (type === "anthropic") {
      newProvider.baseUrl = "https://api.anthropic.com/v1";
    } else {
      newProvider.baseUrl = "";
    }
  }

  function handleProviderSelect(event) {
    const providerId = event.detail;
    newModel.providerId = providerId;
    const selectedProvider = providers.find(p => p.id === providerId);
    if (selectedProvider && selectedProvider.baseUrl) {
      newModel.baseUrl = selectedProvider.baseUrl;
    }
  }

  function selectDiscoveredModel(event) {
    const selectedModel = discoveredModels.find(m => m.id === event.detail);
    if (selectedModel) {
      newModel.model = selectedModel.id;
      newModel.name = selectedModel.name;
    }
  }

  function handleSubmitProvider() {
    if (!newProvider.name?.trim()) {
      toast({
        title: "Validation Error",
        description: "Provider name is required",
        type: "error"
      });
      return;
    }
    
    if (!newProvider.type) {
      toast({
        title: "Validation Error",
        description: "Provider type is required",
        type: "error"
      });
      return;
    }

    if (!newProvider.apiKey?.trim()) {
      toast({
        title: "Validation Error",
        description: "API key is required",
        type: "error"
      });
      return;
    }
    
    console.log("Submitting provider data:", { 
      name: newProvider.name,
      type: newProvider.type,
      baseUrl: newProvider.baseUrl,
      apiKey: newProvider.apiKey ? "***" : undefined,
      isCustom: newProvider.type === "custom"
    });
    
    addProvider();
    showProviderDialog = false;
  }

  let isTestingProviderKey = false;

  async function testProviderKey() {
    try {
      isTestingProviderKey = true;
      const sanitizedApiKey = typeof newProvider.apiKey === 'string' ?
        newProvider.apiKey.replace(/TypeError:.*|Error:.*$/g, '').trim() : '';
        
      if (!sanitizedApiKey) {
        throw new Error("Please enter a valid API key");
      }
      
      const response = await fetch('/api/providers/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: newProvider.type,
          apiKey: sanitizedApiKey,
          baseUrl: newProvider.baseUrl
        })
      });

      const result = await response.json();
      if (result.success) {
        toast({
          title: "Success",
          description: "API key is valid",
          type: "success"
        });
      } else {
        throw new Error(result.message || "Invalid API key");
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to validate API key",
        type: "error"
      });
    } finally {
      isTestingProviderKey = false;
    }
  }
</script>

<div class="max-w-4xl mx-auto px-4 py-8">
  <div class="mb-8">
    <h1 class="text-2xl font-bold mb-2">Admin Settings</h1>
    <p class="text-gray-600">Manage LLM providers and models</p>
  </div>

  <div class="mb-8">
    <Card>
      <CardHeader>
        <CardTitle>AI Providers</CardTitle>
        <CardDescription>Configure AI service providers</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="space-y-4">
          {#if providers.length > 0}
            <div class="grid gap-4">
              {#each providers as provider}
                <div class="border rounded-md p-4 flex justify-between items-center">
                  <div>
                    <h3 class="font-medium">{provider.name}</h3>
                    <p class="text-sm text-gray-500">
                      Type: {providerTypes.find(t => t.value === provider.type)?.label || provider.type}
                      {#if provider.isCustom}
                        (Custom)
                      {/if}
                    </p>
                    {#if provider.baseUrl}
                      <p class="text-xs text-gray-400">{provider.baseUrl}</p>
                    {/if}
                  </div>
                  <Button variant="destructive" size="sm" on:click={() => deleteProvider(provider.id)}>Delete</Button>
                </div>
              {/each}
            </div>
          {:else}
            <p class="text-center text-gray-500 py-4">No providers configured yet</p>
          {/if}
          <Button class="w-full" on:click={() => showProviderDialog = true}>Add Provider</Button>
        </div>
      </CardContent>
    </Card>
  </div>

  {#if showProviderDialog}
    <DialogPrimitive.Root bind:open={showProviderDialog}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" />
        <div class="fixed inset-0 z-50 flex items-center justify-center">
          <DialogPrimitive.Content class="bg-background fixed z-50 grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg sm:rounded-lg">
            <div class="flex flex-col space-y-1.5">
              <h2 class="text-lg font-semibold">Add AI Provider</h2>
              <p class="text-sm text-muted-foreground">Configure a new AI model provider</p>
            </div>
            
            <form class="space-y-4 pt-4" on:submit|preventDefault>
              <div>
                <label for="provider-name" class="block mb-1 font-medium">Provider Name</label>
                <Input id="provider-name" bind:value={newProvider.name} placeholder="e.g., OpenAI Production" required />
              </div>
              
              <div>
                <label for="provider-type" class="block mb-1 font-medium">Provider Type</label>
                <Select onSelectedChange={handleProviderTypeChange} value={newProvider.type} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider type" />
                  </SelectTrigger>
                  <SelectContent>
                    {#each providerTypes as type}
                      <SelectItem value={type.value}>{type.label}</SelectItem>
                    {/each}
                  </SelectContent>
                </Select>
              </div>
              
              <div class="text-xs text-gray-500">
                Selected type: {newProvider.type || 'none'}
              </div>
              
              <div>
                <label for="provider-api-key" class="block mb-1 font-medium">
                  API Key
                  <span class="text-xs font-normal text-gray-500">(required)</span>
                </label>
                <Input 
                  id="provider-api-key" 
                  type="password"
                  bind:value={newProvider.apiKey} 
                  placeholder="Enter API key"
                  required 
                />
              </div>

              {#if newProvider.type === "custom" || !newProvider.baseUrl}
                <div>
                  <label for="base-url" class="block mb-1 font-medium">
                    Base URL
                    <span class="text-xs font-normal text-gray-500">(for custom endpoints)</span>
                  </label>
                  <Input id="base-url" bind:value={newProvider.baseUrl} placeholder="https://api.example.com/v1" />
                </div>
              {/if}

              <div class="flex justify-center">
                <Button 
                  type="button" 
                  variant="outline"
                  class="w-full"
                  on:click={testProviderKey} 
                  disabled={isTestingProviderKey || !newProvider.apiKey}
                >
                  {#if isTestingProviderKey}
                    Testing...
                  {:else}
                    Test API Key
                  {/if}
                </Button>
              </div>
            </form>
            
            <div class="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" on:click={() => { resetProviderForm(); showProviderDialog = false; }}>
                Cancel
              </Button>
              <Button type="button" on:click={handleSubmitProvider}>
                Add Provider
              </Button>
            </div>
            
            <button
              class="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
              on:click={() => showProviderDialog = false}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              <span class="sr-only">Close</span>
            </button>
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  {/if}

  <div class="mb-8">
    <Card>
      <CardHeader>
        <CardTitle>Model Configurations</CardTitle>
        <CardDescription>Manage available LLM models</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="space-y-4">
          {#if models.length > 0}
            <div class="grid gap-4">
              {#each models as model}
                <div class="border rounded-md p-4">
                  <div class="flex justify-between items-center mb-2">
                    <div>
                      <h3 class="font-medium">{model.name}</h3>
                      <p class="text-sm text-gray-500">
                        Provider: {model.provider?.name || 'Unknown'}
                      </p>
                    </div>
                    <div class="flex items-center gap-2">
                      <label class="inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={model.enabled}
                          on:change={(e) => toggleModelStatus(model.id, e.target.checked)}
                          class="sr-only peer"
                        >
                        <div class="relative w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                      </label>
                      <Button variant="destructive" size="sm" on:click={() => deleteModel(model.id)}>Delete</Button>
                    </div>
                  </div>
                  <p class="text-xs text-gray-400">Model ID: {model.model}</p>
                  <p class="text-xs text-gray-400">API URL: {model.baseUrl}</p>
                </div>
              {/each}
            </div>
          {:else}
            <p class="text-center text-gray-500 py-4">No models configured yet</p>
          {/if}
          <Button class="w-full" on:click={() => showModelDialog = true}>Add Model</Button>
        </div>
      </CardContent>
    </Card>
  </div>

  {#if showModelDialog}
    <DialogPrimitive.Root bind:open={showModelDialog}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" />
        <div class="fixed inset-0 z-50 flex items-center justify-center">
          <DialogPrimitive.Content class="bg-background fixed z-50 grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg sm:rounded-lg">
            <div class="flex flex-col space-y-1.5">
              <h2 class="text-lg font-semibold">Add AI Model</h2>
              <p class="text-sm text-muted-foreground">Configure a new AI model</p>
            </div>
            
            <form class="space-y-4 pt-4">
              <div>
                <label for="model-name" class="block mb-1 font-medium">Model Name</label>
                <Input id="model-name" bind:value={newModel.name} placeholder="e.g., GPT-3.5 Turbo" />
              </div>
              
              <div>
                <label for="provider-select" class="block mb-1 font-medium">Provider</label>
                <Select onSelectedChange={handleProviderSelect} value={newModel.providerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {#each providers as provider}
                      <SelectItem value={provider.id}>{provider.name}</SelectItem>
                    {/each}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label for="api-key" class="block mb-1 font-medium">API Key</label>
                <Input id="api-key" bind:value={newModel.apiKey} placeholder="sk-..." />
              </div>
              
              <div>
                <label for="base-url" class="block mb-1 font-medium">Base URL</label>
                <Input id="base-url" bind:value={newModel.baseUrl} placeholder="https://api.example.com/v1" />
              </div>
              
              <div>
                <label for="model-select" class="block mb-1 font-medium">Model</label>
                <Select onSelectedChange={selectDiscoveredModel} value={newModel.model}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {#each discoveredModels as model}
                      <SelectItem value={model.id}>{model.name}</SelectItem>
                    {/each}
                  </SelectContent>
                </Select>
              </div>
              
              <div class="flex justify-center">
                <Button type="button" on:click={testApiKey} class="w-full" disabled={isTestingKey}>
                  {#if isTestingKey}
                    Testing...
                  {:else}
                    Test API Key & Discover Models
                  {/if}
                </Button>
              </div>
            </form>
            
            <div class="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" on:click={() => { resetModelForm(); showModelDialog = false; }}>Cancel</Button>
              <Button type="button" on:click={() => { addModel(); showModelDialog = false; }}>Add Model</Button>
            </div>
            
            <button
              class="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
              on:click={() => showModelDialog = false}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              <span class="sr-only">Close</span>
            </button>
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  {/if}

  <form on:submit|preventDefault={saveSettings} class="space-y-8">
    <div class="space-y-4">
      <h2 class="text-xl font-semibold">API Configuration</h2>
      <div class="border rounded-lg p-4 space-y-4">
        <div>
          <label for="apiKey" class="block mb-1 font-medium">OpenAI API Key</label>
          <Input type="password" id="apiKey" bind:value={apiKey} placeholder="sk-..." class="w-full" />
          <p class="mt-1 text-xs text-gray-500">This key is used for all API requests when using OpenAI models.</p>
        </div>
      </div>
    </div>

    <div class="space-y-4">
      <h2 class="text-xl font-semibold">Model Settings</h2>
      <div class="border rounded-lg p-4 space-y-6">
        <div>
          <div class="flex items-center justify-between mb-2">
            <h3 class="font-medium">GPT-3.5</h3>
            <label class="inline-flex items-center cursor-pointer">
              <input type="checkbox" bind:checked={modelSettings.gpt35.enabled} class="sr-only peer">
              <div class="relative w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
            </label>
          </div>
          <Input type="text" bind:value={modelSettings.gpt35.apiUrl} placeholder="API Endpoint" class="w-full" />
        </div>

        <div>
          <div class="flex items-center justify-between mb-2">
            <h3 class="font-medium">GPT-4</h3>
            <label class="inline-flex items-center cursor-pointer">
              <input type="checkbox" bind:checked={modelSettings.gpt4.enabled} class="sr-only peer">
              <div class="relative w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
            </label>
          </div>
          <Input type="text" bind:value={modelSettings.gpt4.apiUrl} placeholder="API Endpoint" class="w-full" />
        </div>
      </div>
    </div>

    <div class="space-y-4">
      <h2 class="text-xl font-semibold">Usage Limits</h2>
      <div class="border rounded-lg p-4 space-y-4">
        <div>
          <label for="userLimit" class="block mb-1 font-medium">Maximum Users</label>
          <Input type="number" id="userLimit" bind:value={userLimit} min="1" class="w-full" />
        </div>
        <div>
          <label for="requestLimit" class="block mb-1 font-medium">Max Requests Per User (Daily)</label>
          <Input type="number" id="requestLimit" bind:value={maxRequestsPerDay} min="1" class="w-full" />
        </div>
      </div>
    </div>

    <div class="pt-4">
      <Button type="submit" class="px-6">Save Settings</Button>
    </div>
  </form>
</div>
