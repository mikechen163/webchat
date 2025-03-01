<script lang="ts">
  import "../app.css";
  import { toast } from "$lib/components/ui/toast";
  import { sessionsStore } from '$lib/stores/sessions';
  import { invalidate } from '$app/navigation';
  import { toasts } from '$lib/stores/toast';
  import { Toaster } from "svelte-sonner";
  
  // 提供invalidate方法给store
  $sessionsStore.invalidate = () => {
    invalidate('chats:list');
  };
</script>



<div class="h-[100vh] overflow-hidden bg-background font-sans antialiased">
  <slot />
</div>

{#if $toast}
  <div class="fixed top-4 right-4 z-50 flex flex-col gap-2">
    {#each $toast as t}
      <div class="bg-white shadow-lg rounded-lg p-4 {t.type === 'error' ? 'bg-red-50' : ''} animate-in fade-in">
        {t.message}
      </div>
    {/each}
  </div>
{/if}

<div class="toast-container">
    {#each $toasts as toast (toast.id)}
        <div class="toast toast-{toast.type}">
            <span>{toast.message}</span>
            <button on:click={() => toasts.remove(toast.id)}>×</button>
        </div>
    {/each}
</div>

<Toaster richColors closeButton />

<style>
    .toast-container {
        position: fixed;
        top: 1rem;
        right: 1rem;
        z-index: 1000;
    }

    .toast {
        margin-bottom: 0.5rem;
        padding: 1rem;
        border-radius: 0.25rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-width: 200px;
    }

    .toast-success {
        background-color: #4caf50;
        color: white;
    }

    .toast-error {
        background-color: #f44336;
        color: white;
    }

    .toast-info {
        background-color: #2196f3;
        color: white;
    }

    button {
        background: none;
        border: none;
        color: inherit;
        font-size: 1.2rem;
        cursor: pointer;
        padding: 0 0.5rem;
    }
</style>
