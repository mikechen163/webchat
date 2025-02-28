<script lang="ts">
  import { Select as SelectPrimitive } from "bits-ui";
  import { cn } from "$lib/utils";
  import { scale } from "svelte/transition";

  type $$Props = SelectPrimitive.ContentProps & {
    class?: string;
  };

  let className: $$Props["class"] = undefined;
  export { className as class };
</script>

<SelectPrimitive.Content
  transition={scale}
  transitionConfig={{ duration: 200 }}
  class={cn(
    "relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
    className
  )}
  {...$$restProps}
>
  <div class="w-full p-1">
    <slot />
  </div>
</SelectPrimitive.Content>
