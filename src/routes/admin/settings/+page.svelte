<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { toast } from "$lib/components/ui/toast";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { onMount } from "svelte";

  // Redirect non-admin users
  onMount(() => {
    if ($page.data.user?.role !== 'admin') {
      goto('/chat');
      toast({
        title: "Access Denied",
        description: "You don't have permission to access admin settings",
        type: "error"
      });
    }
  });

  // Settings variables
  let apiKey = "";
  let modelSettings = {
    gpt35: { enabled: true, apiUrl: "https://api.openai.com/v1" },
    gpt4: { enabled: true, apiUrl: "https://api.openai.com/v1" }
  };
  let userLimit = 100;
  let maxRequestsPerDay = 50;

  // Mock saving settings
  async function saveSettings() {
    // In a real app, this would send data to the server
    await new Promise(resolve => setTimeout(resolve, 800));
    toast({
      title: "Settings Saved",
      description: "Admin settings have been updated successfully",
      type: "success"
    });
  }
</script>

<div class="max-w-4xl mx-auto px-4 py-8">
  <div class="mb-8">
    <h1 class="text-2xl font-bold mb-2">Admin Settings</h1>
    <p class="text-gray-600">Configure global application settings</p>
  </div>

  <form on:submit|preventDefault={saveSettings} class="space-y-8">
    <!-- API Configuration -->
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

    <!-- Model Settings -->
    <div class="space-y-4">
      <h2 class="text-xl font-semibold">Model Settings</h2>
      <div class="border rounded-lg p-4 space-y-6">
        <!-- GPT-3.5 Settings -->
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

        <!-- GPT-4 Settings -->
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

    <!-- Usage Limits -->
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
