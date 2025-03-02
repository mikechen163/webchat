<script lang="ts">
  import { onMount } from "svelte";
  import { selectedModel } from "$lib/stores/selectedModel";
  import type { ModelConfig } from "@prisma/client";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
    DropdownMenuSeparator,
  } from "$lib/components/ui/dropdown-menu";

  // 新增参数: 是否显示完整模型名称
  export let showFullName = false;

  let models: ModelConfig[] = [];
  let loading = true;
  let error: string | null = null;

  // 按provider分组模型
  $: modelsByProvider = models.reduce((acc, model) => {
    const providerName = model.provider?.name || "其他";
    if (!acc[providerName]) {
      acc[providerName] = [];
    }
    acc[providerName].push(model);
    return acc;
  }, {} as Record<string, ModelConfig[]>);

  $: providerNames = Object.keys(modelsByProvider).sort();

  // 确定是否模型太多，需要使用二级菜单
  $: useTwoLevelMenu = models.length > 8; // 如果超过8个模型，使用二级菜单

  // 生成完整的模型显示名称 (provider/model)
  function getFullModelName(model: ModelConfig): string {
    const providerName = model.provider?.name || "其他";
    return `${providerName}/${model.name}`;
  }

  // 获取显示名称: 根据showFullName参数决定是否显示完整名称
  $: displayName = $selectedModel 
    ? (showFullName ? getFullModelName($selectedModel) : $selectedModel.name) 
    : "Select Model";

  // 加载所有模型
  async function loadAllModels() {
    try {
      loading = true;
      error = null;
      const response = await fetch("/api/models/all");
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      models = await response.json();
      console.log('Loaded all models:', models);
      
      if (!$selectedModel && models.length > 0) {
        selectedModel.set(models[0]);
      }
    } catch (err) {
      console.error('Error loading models:', err);
      error = err.message;
    } finally {
      loading = false;
    }
  }

  function selectModel(model: ModelConfig) {
    selectedModel.set(model);
  }

  // 根据模型获取其提供商名称
  function getProviderName(model: ModelConfig): string {
    return model.provider?.name || "其他";
  }

  onMount(() => {
    loadAllModels();
  });
</script>

<DropdownMenu>
  <DropdownMenuTrigger>
    <div class="px-2 md:px-3 py-1 md:py-1.5 rounded-full hover:bg-gray-100 flex items-center gap-1 md:gap-1.5 whitespace-nowrap">
      <span>🛠</span>
      <span class="text-xs md:text-sm">{displayName}</span>
    </div>
  </DropdownMenuTrigger>
  
  <DropdownMenuContent align={showFullName ? "end" : "start"} class="w-56">
    {#if loading}
      <DropdownMenuItem disabled>
        <span class="text-gray-400">Loading models...</span>
      </DropdownMenuItem>
    {:else if error}
      <DropdownMenuItem disabled>
        <span class="text-red-500">Error: {error}</span>
      </DropdownMenuItem>
    {:else if providerNames.length === 0}
      <DropdownMenuItem disabled>
        <span class="text-gray-400">No models available</span>
      </DropdownMenuItem>
    {:else if useTwoLevelMenu}
      <!-- 二级菜单显示 - 先显示提供商，悬停时显示模型 -->
      {#each providerNames as providerName, i}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <div class="flex items-center justify-between w-full">
              <span>{providerName}</span>
              {#if $selectedModel && getProviderName($selectedModel) === providerName}
                <span class="text-green-500 ml-2">✓</span>
              {/if}
            </div>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent class="w-56">
            {#each modelsByProvider[providerName] as model}
              <DropdownMenuItem on:click={() => selectModel(model)}>
                <div class="flex items-center justify-between w-full">
                  <span class="truncate">{model.name}</span>
                  {#if model.id === $selectedModel?.id}
                    <span class="text-green-500 ml-2 flex-shrink-0">✓</span>
                  {/if}
                </div>
              </DropdownMenuItem>
            {/each}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {#if i < providerNames.length - 1}
          <DropdownMenuSeparator />
        {/if}
      {/each}
    {:else}
      <!-- 扁平菜单显示 - 当模型较少时 -->
      {#each providerNames as providerName, i}
        <div class="px-2 py-1 text-sm font-semibold text-gray-500">
          {providerName}
        </div>
        {#each modelsByProvider[providerName] as model}
          <DropdownMenuItem on:click={() => selectModel(model)}>
            <div class="flex items-center justify-between w-full">
              <span class="truncate">{model.name}</span>
              {#if model.id === $selectedModel?.id}
                <span class="text-green-500 ml-2 flex-shrink-0">✓</span>
              {/if}
            </div>
          </DropdownMenuItem>
        {/each}
        {#if i < providerNames.length - 1}
          <DropdownMenuSeparator />
        {/if}
      {/each}
    {/if}
  </DropdownMenuContent>
</DropdownMenu>
