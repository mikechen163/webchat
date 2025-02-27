<script lang="ts">
  import { page } from "$app/stores";
  import { Button } from "$lib/components/ui/button";
</script>

<div class="flex h-screen max-h-[95%]">
  <!-- Sidebar -->
  <div class="w-[240px]  bg-[#e5e5e5] text-white p-4 flex flex-col">
    <Button variant="outline" class="mb-4 w-full" href="/chat/new">
      New Chat
    </Button>
    
    <nav class="flex-1 overflow-y-auto">
      {#each $page.data.sessions || [] as session}
        <a
          href="/chat/{session.id}"
          class="block p-2 hover:bg-gray-800 rounded {$page.params.id === session.id ? 'bg-gray-800' : ''}"
        >
          {session.title}
        </a>
      {/each}
    </nav>

    <div class="mt-auto">
      <Button variant="ghost" class="w-full" href="/settings">
        Settings
      </Button>
    </div>
  </div>

  <!-- Main Content -->
  <div class="flex-1 flex flex-col">
    <slot />
  </div>
</div>
