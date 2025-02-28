<script lang="ts">
  import { Select as SelectPrimitive } from "bits-ui";
  import { cn } from "$lib/utils";
  import { Check } from "lucide-svelte";

  type $$Props = SelectPrimitive.ItemProps & {
    class?: string;
  };

  let className: $$Props["class"] = undefined;
  export { className as class };
</script>

<SelectPrimitive.Item
  class={cn(
    "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 focus:bg-accent focus:text-accent-foreground",
    className
  )}
  {...$$restProps}
>
  <span class="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
    <SelectPrimitive.ItemIndicator>
      <Check class="h-4 w-4" />
    </SelectPrimitive.ItemIndicator>
  </span>
  <SelectPrimitive.ItemText>
    <slot />
  </SelectPrimitive.ItemText>
</SelectPrimitive.Item>
