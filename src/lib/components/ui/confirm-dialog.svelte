<script lang="ts">
  import { scale } from "svelte/transition";
  import { Button } from "./button";

  export let x = 0;
  export let y = 0;
  export let onConfirm: () => void;
  export let onCancel: () => void;
  export let message = "Are you sure?";
</script>

<div 
  class="fixed z-[60] bg-white rounded-md shadow-lg border p-4 min-w-[200px] max-w-[300px]"
  style="left: {x}px; top: {y}px"
  transition:scale={{
    duration: 150,
    start: 0.95
  }}
>
  <p class="text-sm text-gray-700 mb-4">{message}</p>
  <div class="flex justify-end gap-2">
    <Button 
      variant="outline" 
      size="sm"
      on:click={onCancel}
    >
      Cancel
    </Button>
    <Button 
      variant="destructive" 
      size="sm"
      on:click={onConfirm}
    >
      Delete
    </Button>
  </div>
</div>
