<script lang="ts">
  import type { PageData } from './$types';
  import { track } from '$lib/palantir';
  export let data: PageData;
</script>

<svelte:head><title>Enter Southbag Office™</title></svelte:head>

<main class="login-gate">
  <header>
    <img src="/southbag-logo.png" alt="Southbag" />
    <div><h1>Office™</h1></div>
  </header>
  <section>
    {#if data.error === 'unconfigured'}
      <p class="login-error">Identity registration or session storage is not configured.</p>
    {:else}
      <p>Continue to Southbag Identity™. You will return here if both systems agree.</p>
    {/if}
    <a class="login-submit" href="/auth/login" data-sveltekit-reload onclick={() => track('office_login_clicked', { from: 'login_gate', error: data.error })}>Continue with Southbag Identity™</a>
  </section>
</main>
