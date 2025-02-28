<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { toast } from "$lib/components/ui/toast";
  import { page } from "$app/stores";
  import { selectedModel } from "$lib/stores/selectedModel";
  import { language, t } from "$lib/stores/i18n";
  
  // User preferences
  let username = $page.data.user?.email.split('@')[0] || "";
  let displayName = "";
  let preferredTheme = "system";
  let defaultModel = $selectedModel?.id || "gpt-3.5-turbo";
  let preferredLanguage = "en";
  
  // Available themes
  const themes = [
    { value: "system", label: "System Default" },
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" }
  ];
  
  // Available models
  const models = [
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

  // Update language when preference changes
  function handleLanguageChange(event: Event) {
    const newLang = (event.target as HTMLSelectElement).value;
    preferredLanguage = newLang;
    language.set(newLang);
  }

  // Save user preferences
  async function savePreferences() {
    // In a real app, this would send data to the server
    await new Promise(resolve => setTimeout(resolve, 800));
    toast({
      title: "Preferences Updated",
      description: "Your preferences have been saved successfully",
      type: "success"
    });
  }
</script>

<div class="max-w-2xl mx-auto px-4 py-8">
  <div class="mb-8">
    <h1 class="text-2xl font-bold mb-2">{t('userPreferences.title', currentLang)}</h1>
    <p class="text-gray-600">{t('userPreferences.subtitle', currentLang)}</p>
  </div>

  <form on:submit|preventDefault={savePreferences} class="space-y-6">
    <!-- Profile Settings -->
    <div class="space-y-4">
      <h2 class="text-lg font-semibold">{t('userPreferences.profileSettings', currentLang)}</h2>
      <div class="border rounded-lg p-4 space-y-4">
        <div>
          <label for="username" class="block mb-1 font-medium">{t('userPreferences.username', currentLang)}</label>
          <Input type="text" id="username" bind:value={username} class="w-full" />
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
        </div>
      </div>
    </div>

    <!-- Appearance -->
    <div class="space-y-4">
      <h2 class="text-lg font-semibold">{t('userPreferences.appearance', currentLang)}</h2>
      <div class="border rounded-lg p-4 space-y-4">
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
        </div>
      </div>
    </div>

    <!-- Chat Preferences -->
    <div class="space-y-4">
      <h2 class="text-lg font-semibold">Chat Preferences</h2>
      <div class="border rounded-lg p-4 space-y-4">
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
        </div>

        <!-- Message Display Options -->
        <div class="pt-2">
          <label class="block mb-3 font-medium">Message Display Options</label>
          <div class="space-y-2">
            <label class="flex items-center">
              <input type="checkbox" class="rounded text-blue-600 mr-2">
              <span>Show timestamps</span>
            </label>
            <label class="flex items-center">
              <input type="checkbox" class="rounded text-blue-600 mr-2">
              <span>Compact message view</span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <div class="pt-4">
      <Button type="submit" class="px-6">Save Preferences</Button>
    </div>
  </form>
</div>
