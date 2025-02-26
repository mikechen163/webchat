<script lang="ts">
  import { enhance } from "$app/forms";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";

  let loading = false;
  let error: string | null = null;
</script>

<div class="container mx-auto max-w-md mt-10">
  <h1 class="text-2xl font-bold mb-5">Register</h1>
  
  <form method="POST" use:enhance={() => {
    loading = true;
    return async ({ result }) => {
      loading = false;
      if (result.type === 'error') {
        error = result.error.message;
      }
    };
  }}>
    <div class="space-y-4">
      <div class="space-y-2">
        <Label for="email">Email</Label>
        <Input type="email" name="email" id="email" required />
      </div>
      
      <div class="space-y-2">
        <Label for="password">Password</Label>
        <Input type="password" name="password" id="password" required />
      </div>

      {#if error}
        <p class="text-red-500">{error}</p>
      {/if}

      <Button type="submit" disabled={loading}>
        {loading ? 'Loading...' : 'Register'}
      </Button>
    </div>
  </form>
</div>
