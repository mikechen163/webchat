<script lang="ts">
  import { onMount } from "svelte";
  import { selectedModel } from "$lib/stores/selectedModel";
  import type { ModelConfig } from "@prisma/client";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from "$lib/components/ui/dropdown-menu";

  let models: ModelConfig[] = [];

  onMount(async () => {
    const response = await fetch("/api/models");
    if (response.ok) {
      models = await response.json();
      // Select first enabled model by default if none selected
      if (!$selectedModel && models.length > 0) {
        const defaultModel = models.find(m => m.enabled);
        if (defaultModel) {
          selectedModel.set(defaultModel);
        }
      }
    }
  });

  function selectModel(model: ModelConfig) {
    selectedModel.set(model);
  }
</script>

<DropdownMenu>
  <DropdownMenuTrigger>
    <div class="px-3 py-1.5 rounded-full hover:bg-gray-100 flex items-center gap-1.5">
      <span>🛠</span>
      <span>{$selectedModel?.name || "Select Model"}</span>
    </div>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    {#each models.filter(m => m.enabled) as model}
      <DropdownMenuItem on:click={() => selectModel(model)}>
        <div class="flex items-center gap-2">
          <span>{model.name}</span>
          {#if model.id === $selectedModel?.id}
            <span class="text-green-500">✓</span>
          {/if}
        </div>
      </DropdownMenuItem>
    {/each}
  </DropdownMenuContent>
</DropdownMenu>
