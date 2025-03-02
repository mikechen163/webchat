<script lang="ts">
  import { enhance } from "$app/forms";
  import { goto } from "$app/navigation";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";

  let loading = false;
  let error: string | null = null;
</script>

<svelte:head>
  <meta http-equiv="Content-Security-Policy" content="form-action 'self'">
</svelte:head>

<div class="flex flex-col space-y-2 text-center">
  <h1 class="text-2xl font-semibold tracking-tight">Welcome back</h1>
  <p class="text-sm text-muted-foreground">Enter your credentials to continue</p>
</div>

<div class="grid gap-6">
  <form
    method="POST"
    class="space-y-4"
    use:enhance={() => {
      loading = true;
      return async ({ result }) => {
        loading = false;
        if (result.type === 'error') {
          error = result.error.message;
        } else if (result.data?.success) {
          await goto('/chat');
        }
      };
    }}
  >
    <div class="space-y-2">
      <Label for="email">Email</Label>
      <Input id="email" name="email" type="email" required />
    </div>
    <div class="space-y-2">
      <Label for="password">Password</Label>
      <Input id="password" name="password" type="password" required />
    </div>

    {#if error}
      <div class="text-sm text-red-500">{error}</div>
    {/if}

    <Button type="submit" class="w-full" {loading}>
      {loading ? 'Signing in...' : 'Sign in'}
    </Button>
  </form>

  <div class="text-sm text-muted-foreground text-center">
    Don't have an account?
    <a href="/auth/register" class="underline">Register</a>
  </div>
</div>
