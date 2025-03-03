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
  let discoveredModels: Array<{id: string; name: string; enabled?: boolean}> = [];
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
      // baseUrl: provider.type === "openai" ? "https://api.openai.com/v1" : 
      //         provider.type === "gemini" ? "https://generativelanguage.googleapis.com/v1beta" :
      //         provider.type === "anthropic" ? "https://api.anthropic.com/v1" :
      //         provider.baseUrl?.trim() || "",
        baseUrl: provider.baseUrl?.trim() || '',
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

  let customModels: Array<{name: string; enabled: boolean}> = [];
  let isCustomProvider = false;

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
        discoveredModels = (result.models || []).map(m => ({ ...m, enabled: false }));
        isCustomProvider = discoveredModels.length === 0;
        showToast({
          title: "Success",
          description: `API key is valid! ${discoveredModels.length ? `Found ${discoveredModels.length} models.` : 'No models found, using custom mode.'}`,
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
      discoveredModels = [];
      isCustomProvider = true;
    } finally {
      isTestingProviderKey = false;
    }
  }

  async function toggleModel(modelId: string | undefined, enabled: boolean, customModel?: {name: string; enabled: boolean}) {
    if (customModel) {
      // Handle custom model
      try {
        const modelConfig = {
          name: customModel.name,
          baseUrl: newProvider.baseUrl,
          apiKey: newProvider.apiKey,
          model: customModel.name, // Use name as model identifier for custom models
          providerId: editingProviderId || undefined,
          enabled: true,
          temperature: 0.7,
          maxTokens: 8000
        };

        const response = await fetch('/api/models', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(modelConfig)
        });

        if (response.ok) {
          customModel.enabled = true;
          showToast({
            title: "Success",
            description: `Custom model ${customModel.name} enabled`,
            type: "default"
          });
        } else {
          throw new Error("Failed to enable custom model");
        }
      } catch (err) {
        showToast({
          title: "Error",
          description: err instanceof Error ? err.message : "Failed to enable custom model",
          type: "error"
        });
        customModel.enabled = false;
      }
      return;
    }

    // Handle discovered models
    const model = discoveredModels.find(m => m.id === modelId);
    if (!model) return;

    if (enabled) {
      try {
        const modelConfig = {
          name: model.name,
          baseUrl: newProvider.baseUrl,
          apiKey: newProvider.apiKey,
          model: model.id,
          providerId: editingProviderId || undefined,
          enabled: true,
          temperature: 0.7,
          maxTokens: 8000
        };

        const response = await fetch('/api/models', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(modelConfig)
        });

        if (response.ok) {
          model.enabled = true;
          showToast({
            title: "Success",
            description: `Model ${model.name} enabled`,
            type: "default"
          });
        } else {
          throw new Error("Failed to enable model");
        }
      } catch (err) {
        showToast({
          title: "Error",
          description: err instanceof Error ? err.message : "Failed to enable model",
          type: "error"
        });
        model.enabled = false;
      }
    }
  }

  function addCustomModel() {
    customModels = [...customModels, { name: '', enabled: false }];
  }

  function removeCustomModel(index: number) {
    customModels = customModels.filter((_, i) => i !== index);
  }

  let isEditing = false;
  let editingProviderId = null;
  let showApiKey = false; // New state to toggle API key visibility

  async function handleEditProvider(provider) {
    isEditing = true;
    editingProviderId = provider.id;
    showApiKey = false; // Reset API key visibility to hidden
    
    try {
      // Fetch the full provider details including API key
      const response = await fetch(`/api/providers/${provider.id}`);
      if (response.ok) {
        const fullProvider = await response.json();
        newProvider = {
          name: fullProvider.name,
          type: fullProvider.type,
          baseUrl: fullProvider.baseUrl || "",
          apiKey: fullProvider.apiKey || "",
          isCustom: fullProvider.isCustom
        };
      } else {
        throw new Error("Failed to fetch provider details");
      }
    } catch (err) {
      showToast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load provider details",
        type: "error"
      });
      // Fall back to basic info if we can't get the full details
      newProvider = {
        name: provider.name,
        type: provider.type,
        baseUrl: provider.baseUrl || "",
        apiKey: "",
        isCustom: provider.isCustom
      };
    }
    
    showProviderDialog = true;
  }

  function toggleApiKeyVisibility() {
    showApiKey = !showApiKey;
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
            <div class="grid gap-4 max-h-[400px] overflow-y-auto pr-2">
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
                <Input id="provider-name" 
                       bind:value={newProvider.name} 
                       placeholder="e.g., OpenAI Production" 
                       required />
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
                  <span class="text-xs font-normal text-gray-500">{isEditing ? "(leave unchanged to keep current key)" : "(required)"}</span>
                </label>
                <div class="flex">
                  <Input 
                    id="provider-api-key" 
                    type={showApiKey ? "text" : "password"}
                    bind:value={newProvider.apiKey} 
                    placeholder={isEditing && !newProvider.apiKey ? "••••••••••••••••" : "Enter API key"}
                    required={!isEditing}
                    class="flex-grow"
                  />
                  <Button 
                    type="button" 
                    variant="ghost" 
                    class="ml-1 px-2" 
                    on:click={toggleApiKeyVisibility}
                  >
                    {#if showApiKey}
                      <!-- Eye-off icon -->
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                    {:else}
                      <!-- Eye icon -->
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    {/if}
                  </Button>
                </div>
              </div>

              <div>
                <label for="base-url" class="block mb-1 font-medium">
                  Base URL
                  <span class="text-xs font-normal text-gray-500">(for custom endpoints)</span>
                </label>
                <Input 
                  id="base-url" 
                  bind:value={newProvider.baseUrl} 
                  placeholder="https://api.example.com/v1" 
                />
              </div>

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

              <!-- Add new model selection section -->
              {#if newProvider.apiKey}
                <div class="border rounded-md p-4 space-y-4">
                  <h3 class="font-medium">Available Models</h3>
                  
                  {#if discoveredModels.length > 0}
                    <div class="space-y-2 max-h-[240px] overflow-y-auto pr-2">
                      {#each discoveredModels as model (model.id)}
                        <div class="flex items-center justify-between py-2">
                          <span class="text-sm">{model.name}</span>
                          <label class="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={model.enabled}
                              on:change={(e) => toggleModel(model.id, e.currentTarget.checked)}
                              class="rounded border-gray-300"
                            />
                            <span class="text-sm">Enable</span>
                          </label>
                        </div>
                      {/each}
                    </div>
                  {:else if isCustomProvider}
                    <div class="space-y-2 max-h-[240px] overflow-y-auto pr-2">
                      {#each customModels as model, i}
                        <div class="flex items-center gap-2">
                          <Input
                            bind:value={model.name}
                            placeholder="Enter model name"
                            class="flex-1"
                          />
                          <Button 
                            variant="ghost" 
                            size="sm"
                            on:click={() => removeCustomModel(i)}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                          </Button>
                          <label class="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              bind:checked={model.enabled}
                              on:change={(e) => toggleModel(undefined, e.currentTarget.checked, model)}
                              disabled={!model.name}
                              class="rounded border-gray-300"
                            />
                            <span class="text-sm">Enable</span>
                          </label>
                        </div>
                      {/each}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        class="w-full"
                        on:click={addCustomModel}
                      >
                        Add Custom Model
                      </Button>
                    </div>
                  {/if}
                </div>
              {/if}

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
