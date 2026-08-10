<script lang="ts">
  import { onMount } from 'svelte';
  import type { DialogRequest } from '$lib/dialog';

  export let request: DialogRequest;
  export let onClose: (confirmed: boolean) => void;

  let primary: HTMLButtonElement;

  onMount(() => primary?.focus());

  function keyboard(event: KeyboardEvent) {
    if (event.key === 'Escape') onClose(false);
  }
</script>

<svelte:window onkeydown={keyboard} />

<div class="dialog-backdrop" role="presentation" onclick={(event) => event.target === event.currentTarget && onClose(false)}>
  <div class="app-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-message">
    <img src="/southbag-logo.png" alt="" />
    <h2 id="dialog-title">{request.title}</h2>
    <p id="dialog-message">{request.message}</p>
    <div class="dialog-actions">
      {#if request.cancelLabel}<button onclick={() => onClose(false)}>{request.cancelLabel}</button>{/if}
      <button class:danger={request.confirmLabel === 'Delete'} bind:this={primary} onclick={() => onClose(true)}>
        {request.confirmLabel ?? 'OK'}
      </button>
    </div>
  </div>
</div>
