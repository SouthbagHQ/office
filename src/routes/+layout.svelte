<script lang="ts">
  import './app.css';
  let { children } = $props();
</script>

<svelte:head>
  <link rel="icon" href="/southbag-logo.png" type="image/png" />
</svelte:head>

{@render children()}
