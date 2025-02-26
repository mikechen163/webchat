<script lang="ts">
  import { cn } from "$lib/utils";
  import { getContext } from "svelte";
  
  let className: string | undefined = undefined;
  export { className as class };
  export let variant: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" = "default";
  export let size: "default" | "sm" | "lg" | "icon" = "default";
  export let href: string | undefined = undefined;
  export let loading = false;

  const buttonVariants = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    outline: "border border-input hover:bg-accent hover:text-accent-foreground",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    link: "underline-offset-4 hover:underline text-primary"
  };

  const buttonSizes = {
    default: "h-10 py-2 px-4",
    sm: "h-9 px-3 rounded-md",
    lg: "h-11 px-8 rounded-md",
    icon: "h-10 w-10"
  };
</script>

{#if href}
  <a
    {href}
    class={cn(
      "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background",
      buttonVariants[variant],
      buttonSizes[size],
      className
    )}
    {...$$restProps}
  >
    <slot />
  </a>
{:else}
  <button
    class={cn(
      "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background",
      buttonVariants[variant],
      buttonSizes[size],
      className
    )}
    disabled={loading}
    {...$$restProps}
  >
    {#if loading}
      <div class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    {/if}
    <slot />
  </button>
{/if}
