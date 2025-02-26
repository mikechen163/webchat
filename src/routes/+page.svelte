<script lang="ts">
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";

  onMount(() => {
    if (browser) {
      goto("/auth/login", { replaceState: true });
    }
  });
</script>

<div class="flex items-center justify-center min-h-screen">
  <div class="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
</div>
