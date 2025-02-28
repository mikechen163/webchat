<script lang="ts">
  import { Dialog as DialogPrimitive } from "bits-ui";
  import { cn } from "$lib/utils";
  import { fly, scale } from "svelte/transition";
  import { Cross2Icon } from "lucide-svelte";
  import Overlay from "./dialog-overlay.svelte";
  
  type $$Props = DialogPrimitive.ContentProps & {
    class?: string;
  };
  
  export let closeOnOutsideClick = true;
  export let closeOnEscape = true;
  export let transition = scale;
  export let transitionConfig = { duration: 200 };
</script>

<!-- Use DialogPrimitive.Portal rather than Dialog.Portal -->
<DialogPrimitive.Portal>
  <Overlay />
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <DialogPrimitive.Content
      {closeOnOutsideClick}
      {closeOnEscape}
      class={cn(
        "bg-background animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 fixed z-50 grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg sm:rounded-lg",
        $$props.class
      )}
      transition={transition}
      transitionConfig={transitionConfig}
      {...$$restProps}
    >
      <div class="flex flex-col space-y-1.5">
        <slot />
      </div>
      <button
        class="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
        on:click={() => DialogPrimitive.close()}
      >
        <Cross2Icon class="h-4 w-4" />
        <span class="sr-only">Close</span>
      </button>
    </DialogPrimitive.Content>
  </div>
</DialogPrimitive.Portal>
