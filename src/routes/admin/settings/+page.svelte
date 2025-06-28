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
  let selectedProviderId = null;
  let activeTab = 'providers';
  let discoveredModelsForProvider = [];
  let showCustomModelForm = false;
  let showDiscoveredModelsDialog = false;
  let currentProviderForDiscovery = null;
  let selectedDiscoveredProvider = null;

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

  async function discoverModels() {
    if (!selectedProviderId) return;

    isTestingKey = true;
    discoveredModelsForProvider = [];
    showCustomModelForm = false;

    try {
      // We need to get the full provider details first, especially the API key
      const providerResponse = await fetch(`/api/providers/${selectedProviderId}`);
      if (!providerResponse.ok) {
        throw new Error("Failed to fetch provider details for model discovery.");
      }
      const fullProvider = await providerResponse.json();
      currentProviderForDiscovery = fullProvider;

      // Re-use the logic from testApiKey, but for the selected provider
      const response = await fetch('/api/providers/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: fullProvider.type,
          apiKey: fullProvider.apiKey,
          baseUrl: fullProvider.baseUrl
        })
      });

      const result = await response.json();
      if (result.success) {
        const existingModels = models
          .filter(m => m.providerId === selectedProviderId)
          .map(m => m.model);

        discoveredModelsForProvider = (result.models || []).filter(discoveredModel => 
          !existingModels.includes(discoveredModel.id)
        );

        if (discoveredModelsForProvider.length > 0) {
          showDiscoveredModelsDialog = true;
        } else if ((result.models || []).length === 0) {
          showCustomModelForm = true;
        }

        showToast({
          title: "Discovery Complete",
          description: `Found ${discoveredModelsForProvider.length} new models.`,
          type: "default"
        });
      } else {
        showCustomModelForm = true;
        throw new Error(result.message || "Failed to discover models");
      }
    } catch (err) {
      showCustomModelForm = true;
      showToast({
        title: "Error",
        description: err instanceof Error ? err.message : "An error occurred during model discovery",
        type: "error"
      });
    } finally {
      isTestingKey = false;
    }
  }
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

  let providersModels = {}; // Store models by provider ID

  async function loadProviders() {
    try {
      const response = await fetch('/api/providers');
      if (response.ok) {
        providers = await response.json();
        
        // Also load all models
        await loadModels();
        
        // Group models by provider ID
        providersModels = models.reduce((acc, model) => {
          if (!acc[model.providerId]) {
            acc[model.providerId] = [];
          }
          acc[model.providerId].push(model);
          return acc;
        }, {});
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
      const response = await fetch('/api/models/all');
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

  async function addModel(modelData) {
    if (!currentProviderForDiscovery) {
        showToast({
            title: "Error",
            description: "Could not add model: provider details are missing. Please try discovering models again.",
            type: "error"
        });
        return;
    }

    try {
        const modelConfig = {
            name: modelData.name,
            model: modelData.model,
            providerId: modelData.providerId,
            baseUrl: currentProviderForDiscovery.baseUrl,
            apiKey: currentProviderForDiscovery.apiKey,
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
        showToast({ title: 'Success', description: 'Model added successfully' });
        loadModels(); // Reload models to show the new one
        
        // Remove the added model from the discovered list
        discoveredModelsForProvider = discoveredModelsForProvider.filter(m => m.id !== modelData.model);
        
        // If no more discovered models, close the dialog
        if (discoveredModelsForProvider.length === 0) {
          showDiscoveredModelsDialog = false;
        }

        showCustomModelForm = false; // Hide custom model form
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add model');
      }
    } catch (err) {
      showToast({ title: 'Error', description: err.message, type: 'error' });
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
        const error = await response.json();
        throw new Error(error.message || "Failed to delete model");
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
    discoveredModels = [];
    customModels = [];
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
        // Get existing models for this provider
        const existingModels = isEditing && editingProviderId ? 
          (providersModels[editingProviderId] || []) : [];
        
        // Mark models as enabled if they already exist for this provider
        discoveredModels = (result.models || []).map(m => {
          // Check if this model already exists for this provider
          const modelExists = existingModels.some(
            existingModel => existingModel.model === m.id
          );
          
          return { 
            ...m, 
            enabled: modelExists 
          };
        });
        
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
        
        // Load custom models if editing the provider
        if (providersModels[provider.id]) {
          customModels = providersModels[provider.id].map(model => ({
            name: model.model,
            enabled: true
          }));
        }
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

<div class="max-w-5xl mx-auto px-4 py-8 h-full overflow-y-auto">
  <div class="mb-8">
    <h1 class="text-2xl font-bold mb-2">Admin Settings</h1>
    <p class="text-gray-600">Manage LLM providers and models</p>
  </div>

  <div class="flex border-b mb-6">
    <button 
      class="px-4 py-2 -mb-px border-b-2 font-medium text-sm focus:outline-none "
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

  {#if activeTab === 'providers'}
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
  {:else if activeTab === 'models'}
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
              <Button on:click={discoverModels} disabled={isTestingKey}>
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
                        <Button variant="destructive" size="sm" on:click={() => deleteModel(model.id)}>
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



        {#if showCustomModelForm}
           <div class="mt-6">
             <h3 class="text-lg font-medium mb-2">Add Custom Model</h3>
              <Card>
                <CardContent class="pt-6">
                  <p class="text-sm text-gray-600 mb-4">Could not fetch models automatically. You can add a custom model instead.</p>
                  <form on:submit|preventDefault={(e) => {
                    const formData = new FormData(e.target);
                    const name = formData.get('name');
                    const modelId = formData.get('modelId');
                    if (name && modelId) {
                      addModel({ providerId: selectedProviderId, name, model: modelId });
                      e.target.reset();
                    }
                  }} class="space-y-4">
                    <div>
                      <Label for="custom-model-name">Model Name</Label>
                      <Input id="custom-model-name" name="name" placeholder="e.g., My Custom GPT-4" required />
                    </div>
                    <div>
                      <Label for="custom-model-id">Model ID</Label>
                      <Input id="custom-model-id" name="modelId" placeholder="e.g., gpt-4-custom" required />
                    </div>
                    <Button type="submit" class="w-full">Add Custom Model</Button>
                  </form>
                </CardContent>
              </Card>
           </div>
        {/if}
      </div>
    </div>
  {/if}

  {#if showDiscoveredModelsDialog}
    <DialogPrimitive.Root bind:open={showDiscoveredModelsDialog}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" />
        <div class="fixed inset-0 z-50 flex items-center justify-center">
          <DialogPrimitive.Content class="bg-background fixed z-50 grid w-full max-w-4xl h-[80vh] gap-4 border bg-background p-6 shadow-lg sm:rounded-lg flex flex-col">
            <div class="flex flex-col space-y-1.5">
              <h2 class="text-lg font-semibold">Discovered Models</h2>
              <p class="text-sm text-muted-foreground">
                Found {discoveredModelsForProvider.length} new models available from the provider.
              </p>
            </div>
            
            <div class="flex-grow flex flex-row gap-6 overflow-hidden">
              {#if groupedDiscoveredModels}
                <!-- Left Sidebar -->
                <div class="w-1/4 border-r pr-4 overflow-y-auto">
                  <h4 class="font-semibold text-lg mb-2 sticky top-0 bg-background">Providers</h4>
                  {#each Object.keys(groupedDiscoveredModels) as providerName}
                    <button
                      class="w-full text-left p-2 rounded-md text-sm mb-1"
                      class:bg-muted={selectedDiscoveredProvider === providerName}
                      on:click={() => selectedDiscoveredProvider = providerName}
                    >
                      {providerName}
                    </button>
                  {/each}
                </div>

                <!-- Right Content -->
                <div class="flex-1 overflow-y-auto">
                  {#if selectedDiscoveredProvider}
                    <div class="space-y-2">
                      {#each groupedDiscoveredModels[selectedDiscoveredProvider] as model (model.id)}
                        <div class="flex items-center justify-between p-2 border rounded-md">
                          <span class="text-sm">{model.name || model.id}</span>
                          <Button size="sm" on:click={() => addModel({ providerId: selectedProviderId, name: model.name, model: model.id })}>Add</Button>
                        </div>
                      {/each}
                    </div>
                  {/if}
                </div>
              {:else}
                <div class="grid gap-2 mt-4 max-h-[60vh] overflow-y-auto w-full">
                  {#each discoveredModelsForProvider as model (model.id)}
                    <div class="flex items-center justify-between p-2 border rounded-md">
                      <span>{model.name || model.id}</span>
                      <Button size="sm" on:click={() => addModel({ providerId: selectedProviderId, name: model.name, model: model.id })}>Add</Button>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>

            <div class="flex justify-end gap-2 pt-4 border-t mt-auto">
              <Button type="button" variant="outline" on:click={() => { showDiscoveredModelsDialog = false; selectedDiscoveredProvider = null; }}>
                Close
              </Button>
            </div>
            
            <button
              class="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
              on:click={() => showDiscoveredModelsDialog = false}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              <span class="sr-only">Close</span>
            </button>
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  {/if}

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
