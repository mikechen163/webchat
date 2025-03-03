<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Switch } from "$lib/components/ui/switch";
  
  export let data;
  
  let { models, isAdmin } = data;
  let newModel = {
    name: "",
    baseUrl: "",
    apiKey: "",
    model: "",
    enabled: true
  };

  async function handleSubmit() {
    const response = await fetch("/api/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newModel)
    });
    
    if (response.ok) {
      models = [...models, await response.json()];
      newModel = { name: "", baseUrl: "", apiKey: "", model: "", enabled: true };
    }
  }

  async function toggleModel(id: string, enabled: boolean) {
    const response = await fetch(`/api/models/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled })
    });
    
    if (response.ok) {
      models = models.map(m => 
        m.id === id ? { ...m, enabled } : m
      );
    }
  }

  async function handleLogout() {
    const response = await fetch("/auth/logout", {
      method: "POST"
    });
    if (response.ok) {
      window.location.href = "/auth/login";
    }
  }
</script>

<div class="container mx-auto py-8 max-w-4xl">
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-2xl font-bold">Settings</h1>
    <Button variant="outline" on:click={handleLogout}>
      Logout
    </Button>
  </div>

  {#if isAdmin}
    <div class="bg-white p-6 rounded-lg shadow mb-6">
      <h2 class="text-xl font-semibold mb-4">Add New Model</h2>
      <form on:submit|preventDefault={handleSubmit} class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label for="name">Name</Label>
            <Input id="name" bind:value={newModel.name} required />
          </div>
          <div class="space-y-2">
            <Label for="baseUrl">Base URL</Label>
            <Input id="baseUrl" bind:value={newModel.baseUrl} required />
          </div>
          <div class="space-y-2">
            <Label for="apiKey">API Key</Label>
            <Input id="apiKey" type="password" bind:value={newModel.apiKey} required />
          </div>
          <div class="space-y-2">
            <Label for="model">Model</Label>
            <Input id="model" bind:value={newModel.model} required />
          </div>
        </div>
        <Button type="submit">Add Model</Button>
      </form>
    </div>
  {/if}

  <div class="bg-white p-6 rounded-lg shadow">
    <h2 class="text-xl font-semibold mb-4">Available Models</h2>
    <div class="space-y-4">
      {#each models as model}
        <div class="flex items-center justify-between p-4 border rounded">
          <div>
            <h3 class="font-medium">{model.name}</h3>
            <p class="text-sm text-gray-500">{model.model}</p>
          </div>
          <div class="flex items-center gap-2">
            <Switch
              checked={model.enabled}
              onCheckedChange={(checked) => toggleModel(model.id, checked)}
              disabled={!isAdmin}
            />
            <span class="text-sm text-gray-500">
              {model.enabled ? "Enabled" : "Disabled"}
            </span>
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>
