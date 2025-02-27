<script lang="ts">
  import { DropdownMenu } from ".";
  import { cn } from "$lib/utils";
  import { scale } from "svelte/transition";
  import { quadOut } from "svelte/easing";

  export let align: "start" | "end" | "center" = "end";
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    <slot name="trigger" />
  </DropdownMenu.Trigger>
  <DropdownMenu.Content
    {align}
    class={cn(
      "z-50 min-w-[8rem] rounded-md border bg-white p-1 shadow-md",
    )}
    transition={{
      in: scale,
      out: scale,
      opts: {
        duration: 150,
        easing: quadOut
      }
    }}
  >
    <slot name="content" />
  </DropdownMenu.Content>
</DropdownMenu.Root>
