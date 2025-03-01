<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { toast } from "svelte-sonner";
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

  function showToast({ title, description, type = "default" }) {
    if (type === "error") {
      toast.error(description, { title });
    } else {
      toast.success(description, { title });
    }
  }

  onMount(() => {
    if ($page.data.user?.role !== 'admin') {
      goto('/chat');
      toast.error("You don't have permission to access admin settings", {
        title: "Access Denied"
      });
    } else {
      loadProviders();
      loadModels();
    }
  });

  let providers = [];
  let models = [];
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
        showToast({
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
        showToast({
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
        showToast({
          title: "Success",
          description: "Provider added successfully",
          type: "default"
        });
      } else {
        const error = await response.json();
        throw new Error(error.message || "Failed to add provider");
      }
    } catch (err) {
      showToast({
        title: "Error",
        description: err instanceof Error ? err.message : "An error occurred",
        type: "error"
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
        showToast({
          title: "Success",
          description: "Provider deleted successfully",
          type: "default"
        });
      } else {
        const error = await response.text();
        throw new Error(error || "Failed to delete provider");
      }
    } catch (err) {
      showToast({
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
        showToast({
          title: "Success",
          description: `API key valid! Found ${discoveredModels.length} models.`,
          type: "default"
        });
      } else {
        throw new Error(result.message || "API key validation failed");
      }
    } catch (err) {
      showToast({
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
        showToast({
          title: "Success",
          description: "Model added successfully",
          type: "default"
        });
      } else {
        const error = await response.json();
        throw new Error(error.message || "Failed to add model");
      }
    } catch (err) {
      showToast({
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
        showToast({
          title: "Success",
          description: `Model ${enabled ? 'enabled' : 'disabled'} successfully`,
          type: "default"
        });
      } else {
        throw new Error("Failed to update model status");
      }
    } catch (err) {
      showToast({
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
        showToast({
          title: "Success",
          description: "Model deleted successfully",
          type: "default"
        });
      } else {
        throw new Error("Failed to delete model");
      }
    } catch (err) {
      showToast({
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
    isEditing = false;
    editingProviderId = null;
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
      showToast({
        title: "Validation Error",
        description: "Provider name is required",
        type: "error"
      });
      return;
    }
    
    if (!newProvider.type) {
      showToast({
        title: "Validation Error",
        description: "Provider type is required",
        type: "error"
      });
      return;
    }

    if (!newProvider.apiKey?.trim()) {
      showToast({
        title: "Validation Error",
        description: "API key is required",
        type: "error"
      });
      return;
    }
    
    if (isEditing) {
      updateProvider();
    } else {
      addProvider();
    }
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
        showToast({
          title: "Success",
          description: "API key is valid",
          type: "default"
        });
      } else {
        throw new Error(result.message || "Invalid API key");
      }
    } catch (err) {
      showToast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to validate API key",
        type: "error"
      });
    } finally {
      isTestingProviderKey = false;
    }
  }

  let isEditing = false;
  let editingProviderId = null;

  function handleEditProvider(provider) {
    isEditing = true;
    editingProviderId = provider.id;
    newProvider = {
      name: provider.name,
      type: provider.type,
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      isCustom: provider.isCustom
    };
    showProviderDialog = true;
  }

  async function updateProvider() {
    try {
      const providerData = sanitizeProviderData(newProvider);
      
      const response = await fetch(`/api/providers/${editingProviderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(providerData)
      });

      if (response.ok) {
        const result = await response.json();
        providers = providers.map(p => 
          p.id === editingProviderId ? result : p
        );
        resetProviderForm();
        showToast({
          title: "Success",
          description: "Provider updated successfully",
          type: "default"
        });
      } else {
        const error = await response.json();
        throw new Error(error.message || "Failed to update provider");
      }
    } catch (err) {
      showToast({
        title: "Error",
        description: err instanceof Error ? err.message : "An error occurred",
        type: "error"
      });
    } finally {
      isEditing = false;
      editingProviderId = null;
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
                  <div class="flex gap-2">
                    <Button variant="outline" size="sm" on:click={() => handleEditProvider(provider)}>
                      Modify
                    </Button>
                    <Button variant="destructive" size="sm" on:click={() => deleteProvider(provider.id)}>
                      Delete
                    </Button>
                  </div>
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
              <h2 class="text-lg font-semibold">{isEditing ? 'Modify' : 'Add'} AI Provider</h2>
              <p class="text-sm text-muted-foreground">
                {isEditing ? 'Update existing' : 'Configure new'} AI model provider
              </p>
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
                {isEditing ? 'Update' : 'Add'} Provider
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



  
</div>
