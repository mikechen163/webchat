<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { toast } from "$lib/components/ui/toast";
  import { page } from "$app/stores";
  import { selectedModel } from "$lib/stores/selectedModel";
  import { language, t } from "$lib/stores/i18n";
  import { onMount } from "svelte";
  
  // User preferences
  let username = $page.data.user?.email.split('@')[0] || "";
  let displayName = "";
  let preferredTheme = "system";
  let defaultModel = $selectedModel?.id || "gpt-3.5-turbo";
  let searchModel = "gpt-3.5-turbo"; // Default search model
  let preferredLanguage = "en";
  
  // Tab control
  let activeTab = "profile"; // "profile", "appearance", "chat"
  
  // Available themes
  const themes = [
    { value: "system", label: "System Default" },
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" }
  ];
  
  // Available models - we'll fetch these from the API
  let models = [
    { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
    { value: "gpt-4", label: "GPT-4" },
    { value: "claude-instant", label: "Claude Instant" },
  ];

  // Available languages
  const languages = [
    { value: "en", label: "English" },
    { value: "zh", label: "中文" }
  ];

  // Subscribe to language changes
  $: currentLang = $language;
  
  function setActiveTab(tab: string) {
    activeTab = tab;
  }
  
  // Fetch user preferences on mount
  onMount(async () => {
    try {
      const response = await fetch("/api/user/preferences");
      if (response.ok) {
        const prefs = await response.json();
        if (prefs.defaultModel) defaultModel = prefs.defaultModel;
        if (prefs.searchModel) searchModel = prefs.searchModel;
        if (prefs.theme) preferredTheme = prefs.theme;
        if (prefs.language) {
          preferredLanguage = prefs.language;
          language.set(prefs.language);
        }
        if (prefs.displayName) displayName = prefs.displayName;
      }
      
      // Also fetch available models
      const modelsResponse = await fetch("/api/models/all");
      if (modelsResponse.ok) {
        const modelData = await modelsResponse.json();
        models = modelData.map((m: any) => ({ 
          value: m.id, 
          label: `${m.provider?.name || 'Other'} / ${m.name}` 
        }));
      }
    } catch (err) {
      console.error("Failed to load preferences:", err);
    }
  });

  // Update language when preference changes
  function handleLanguageChange(event: Event) {
    const newLang = (event.target as HTMLSelectElement).value;
    preferredLanguage = newLang;
    language.set(newLang);
  }

  // Save user preferences
  async function savePreferences() {
    try {
      const response = await fetch("/api/user/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultModel,
          searchModel,
          theme: preferredTheme,
          language: preferredLanguage,
          displayName
        })
      });
      
      if (response.ok) {
        toast({
          title: t('userPreferences.saveSuccess', currentLang),
          description: t('userPreferences.saveSuccessDetails', currentLang),
          type: "success"
        });
      } else {
        throw new Error("Failed to save preferences");
      }
    } catch (err) {
      toast({
        title: t('userPreferences.saveError', currentLang),
        description: String(err),
        type: "error"
      });
    }
  }
</script>

<div class="max-w-3xl mx-auto px-4 py-8">
  <div class="mb-8">
    <h1 class="text-2xl font-bold mb-2">{t('userPreferences.title', currentLang)}</h1>
    <p class="text-gray-600">{t('userPreferences.subtitle', currentLang)}</p>
  </div>

  <!-- Tab Navigation -->
  <div class="border-b mb-6">
    <div class="flex space-x-1">
      <button 
        class="px-4 py-2 {activeTab === 'profile' ? 'border-b-2 border-blue-500 font-medium text-blue-500' : 'text-gray-500 hover:text-gray-700'}"
        on:click={() => setActiveTab('profile')}
      >
        {currentLang === 'zh' ? '个人资料' : 'Profile'}
      </button>
      
      <button 
        class="px-4 py-2 {activeTab === 'appearance' ? 'border-b-2 border-blue-500 font-medium text-blue-500' : 'text-gray-500 hover:text-gray-700'}"
        on:click={() => setActiveTab('appearance')}
      >
        {currentLang === 'zh' ? '外观' : 'Appearance'}
      </button>
      
      <button 
        class="px-4 py-2 {activeTab === 'chat' ? 'border-b-2 border-blue-500 font-medium text-blue-500' : 'text-gray-500 hover:text-gray-700'}"
        on:click={() => setActiveTab('chat')}
      >
        {currentLang === 'zh' ? '聊天设置' : 'Chat Preferences'}
      </button>
    </div>
  </div>

  <form on:submit|preventDefault={savePreferences} class="space-y-6">
    <!-- Profile Tab -->
    {#if activeTab === 'profile'}
      <div class="space-y-4">
        <div class="border rounded-lg p-6 space-y-6">
          <div>
            <label for="username" class="block mb-1 font-medium">{t('userPreferences.username', currentLang)}</label>
            <Input type="text" id="username" bind:value={username} class="w-full" />
            <p class="text-xs text-gray-500 mt-1">This is your username used for login</p>
          </div>
          
          <div>
            <label for="displayName" class="block mb-1 font-medium">{t('userPreferences.displayName', currentLang)}</label>
            <Input 
              type="text" 
              id="displayName" 
              bind:value={displayName} 
              placeholder={t('userPreferences.displayNamePlaceholder', currentLang)} 
              class="w-full" 
            />
            <p class="text-xs text-gray-500 mt-1">This name will be displayed in chats and notifications</p>
          </div>
          
          <!-- Avatar could be added here in the future -->
        </div>
      </div>
    {/if}

    <!-- Appearance Tab -->
    {#if activeTab === 'appearance'}
      <div class="space-y-4">
        <div class="border rounded-lg p-6 space-y-6">
          <div>
            <label for="language" class="block mb-1 font-medium">{t('userPreferences.language', currentLang)}</label>
            <select
              id="language"
              value={preferredLanguage}
              on:change={handleLanguageChange}
              class="w-full rounded-md border border-gray-300 p-2 text-sm"
            >
              {#each languages as lang}
                <option value={lang.value}>{lang.label}</option>
              {/each}
            </select>
            <p class="text-xs text-gray-500 mt-1">Interface language preference</p>
          </div>
          
          <div>
            <label for="theme" class="block mb-1 font-medium">{t('userPreferences.theme', currentLang)}</label>
            <select
              id="theme"
              bind:value={preferredTheme}
              class="w-full rounded-md border border-gray-300 p-2 text-sm"
            >
              {#each themes as theme}
                <option value={theme.value}>{theme.label}</option>
              {/each}
            </select>
            <p class="text-xs text-gray-500 mt-1">Choose your preferred theme</p>
          </div>
        </div>
      </div>
    {/if}

    <!-- Chat Preferences Tab -->
    {#if activeTab === 'chat'}
      <div class="space-y-4">
        <div class="border rounded-lg p-6 space-y-6">
          <div>
            <label for="defaultModel" class="block mb-1 font-medium">Default AI Model</label>
            <select
              id="defaultModel"
              bind:value={defaultModel}
              class="w-full rounded-md border border-gray-300 p-2 text-sm"
            >
              {#each models as model}
                <option value={model.value}>{model.label}</option>
              {/each}
            </select>
            <p class="text-xs text-gray-500 mt-1">Used when no specific model is selected or when the selected model fails</p>
          </div>

          <div>
            <label for="searchModel" class="block mb-1 font-medium">Search Analysis Model</label>
            <select
              id="searchModel"
              bind:value={searchModel}
              class="w-full rounded-md border border-gray-300 p-2 text-sm"
            >
              {#each models as model}
                <option value={model.value}>{model.label}</option>
              {/each}
            </select>
            <p class="text-xs text-gray-500 mt-1">Used for analyzing queries and search results during web searches</p>
          </div>

          <!-- Message Display Options -->
          <div>
            <label class="block mb-2 font-medium">Message Display Options</label>
            <div class="space-y-3">
              <label class="flex items-center">
                <input type="checkbox" class="rounded text-blue-600 mr-2">
                <span>Show timestamps</span>
              </label>
              <label class="flex items-center">
                <input type="checkbox" class="rounded text-blue-600 mr-2">
                <span>Compact message view</span>
              </label>
              <label class="flex items-center">
                <input type="checkbox" class="rounded text-blue-600 mr-2">
                <span>Enable code syntax highlighting</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    {/if}

    <div class="pt-4 flex justify-end">
      <Button type="submit" class="px-6">Save Preferences</Button>
    </div>
  </form>
</div>
