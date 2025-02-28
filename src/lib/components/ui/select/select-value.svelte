<script lang="ts">
  import { Select as SelectPrimitive } from "bits-ui";
  import { cn } from "$lib/utils";

  type $$Props = SelectPrimitive.ValueProps & {
    class?: string;
  };

  let className: $$Props["class"] = undefined;
  export { className as class };

  export let placeholder: string | undefined = undefined;
</script>

<SelectPrimitive.Value {placeholder} class={cn("text-sm", className)} {...$$restProps}>
  <slot />
</SelectPrimitive.Value>
