<script lang="ts">
  import type { PageData } from './$types';
  export let data: PageData;
</script>

<svelte:head><title>Enter Southbag Office™</title></svelte:head>

<main class="login-gate">
  <header>
    <img src="/logo.svg" alt="Southbag" />
    <div><h1>Southbag Office™</h1><p>Identity is required before productivity can be attempted.</p></div>
  </header>
  <section>
    <strong>AUTHORISATION CHECKPOINT</strong>
    {#if data.error === 'unconfigured'}
      <p class="login-error">The production Identity client is not configured. Development builds use the test OAuth provider automatically.</p>
    {:else}
      <p>Continue to Southbag Identity™. You will return here if both systems agree.</p>
    {/if}
    <a class="login-submit" href="/auth/login">Continue with Southbag Identity™</a>
    <small>No guest entrance. No local-only identities. No explanation desk.</small>
  </section>
</main>
