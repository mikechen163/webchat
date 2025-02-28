<script lang="ts">
  import { Dialog as DialogPrimitive } from "bits-ui";

  type $$Props = DialogPrimitive.RootProps;
  type $$Events = DialogPrimitive.RootEvents;

  export let open = false;
</script>

<DialogPrimitive.Root bind:open {...$$restProps} on:change>
  <slot />
</DialogPrimitive.Root>
