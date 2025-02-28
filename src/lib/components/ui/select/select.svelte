<script lang="ts">
  import { Select as SelectPrimitive } from "bits-ui";
  import type { SelectRootProps } from "bits-ui";

  type $$Props = SelectRootProps;

  export let value: $$Props["value"] = undefined;
  export let onSelectedChange: ((value: any) => void) | undefined = undefined;
</script>

<SelectPrimitive.Root
  bind:value
  on:selected={(e) => {
    if (onSelectedChange) {
      onSelectedChange(e.detail);
    }
  }}
  {...$$restProps}
>
  <slot />
</SelectPrimitive.Root>
