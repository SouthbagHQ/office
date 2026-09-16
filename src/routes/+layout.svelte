<script lang="ts">
  import './app.css';
  let { children, data } = $props();

  // Sign-in state can change without a full reload (invalidation after a redirect back
  // from Identity), so keep PostHog's identity in step with the layout data. palantir.js
  // already identifies from the script's data attributes on load and resets stale
  // profiles itself, so only a sign-out *transition* resets here.
  let previousSub: string | null | undefined;
  $effect(() => {
    const user = data.user;
    const palantir = window.palantir;
    if (!palantir) return;
    window.posthog?.register({ office_workspace_kind: user ? 'account' : 'guest' });
    if (user) palantir.identify({ id: user.sub, email: user.email, name: user.name });
    else if (previousSub) palantir.reset();
    previousSub = user?.sub ?? null;
  });
</script>

<svelte:head>
  <link rel="icon" href="/southbag-logo.png" type="image/png" />
  <script
    src="/palantir.js"
    data-app="office"
    data-user-id={data.user?.sub ?? ''}
    data-user-email={data.user?.email ?? ''}
    data-user-name={data.user?.name ?? ''}
  ></script>
</svelte:head>

{@render children()}
