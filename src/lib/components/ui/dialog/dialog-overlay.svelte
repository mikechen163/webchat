<script lang="ts">
  import { Dialog as DialogPrimitive } from "bits-ui";
  import { cn } from "$lib/utils";
  import { fade } from "svelte/transition";
  
  type $$Props = DialogPrimitive.OverlayProps & {
    class?: string;
  };
  
  export let transition = fade;
  export let transitionConfig = { duration: 150 };
</script>

<DialogPrimitive.Overlay
  class={cn(
    "fixed inset-0 z-50 bg-black/80 backdrop-blur-sm",
    $$props.class
  )}
  {transition}
  {transitionConfig}
  {...$$restProps}
/>
