<script lang="ts">
  import { Select as SelectPrimitive } from "bits-ui";
  import { cn } from "$lib/utils";
  import { Check } from "lucide-svelte";

  type $$Props = SelectPrimitive.ItemProps;
  type $$Events = SelectPrimitive.ItemEvents;

  let className: $$Props["class"] = undefined;
  export { className as class };
  export let value: $$Props["value"];
</script>

<SelectPrimitive.Item
  {value}
  class={cn(
    "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:opacity-50",
    className
  )}
  {...$$restProps}
  let:highlighted
>
  <span class="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
    <SelectPrimitive.ItemIndicator>
      <Check class="h-4 w-4" />
    </SelectPrimitive.ItemIndicator>
  </span>
  <slot />
</SelectPrimitive.Item>
