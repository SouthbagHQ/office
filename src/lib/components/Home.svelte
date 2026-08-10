<script lang="ts">
  import type { Kind, OfficeFile } from '$lib/workspace';
  import { kindLabel } from '$lib/workspace';

  export let files: OfficeFile[];
  export let query: string;
  export let onOpen: (file: OfficeFile) => void;
  export let onCreate: (kind: Kind) => void;

  $: visible = files.filter((file) => file.title.toLowerCase().includes(query.toLowerCase()));

  function dateLabel(value: string) {
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(
      new Date(value)
    );
  }
</script>

<section class="home-view">
  <header class="home-header">
    <div>
      <p class="eyebrow">THE PRODUCTIVITY PORTAL / HOME / SOMEWHERE ELSE</p>
      <h1>Your work is around here</h1>
      <p class="lede">Three professional tools. One shared sense of uncertainty.</p>
    </div>
    <div class="status-stamp"><strong>OPERATIONAL</strong><span>probably</span></div>
  </header>

  <div class="creation-zone">
    <p class="zone-label">Create from nothing (advanced)</p>
    <button class="create-card docs" onclick={() => onCreate('doc')}>
      <span class="paper-icon">¶</span><strong>New document</strong><small>Docs / page paperwork</small>
    </button>
    <button class="create-card slides" onclick={() => onCreate('slides')}>
      <span class="paper-icon">▱</span><strong>New presentation</strong><small>Slides / public speaking file</small>
    </button>
    <button class="create-card sheets" onclick={() => onCreate('sheet')}>
      <span class="paper-icon">⌗</span><strong>New spreadsheet</strong><small>Sheets / cells in captivity</small>
    </button>
    <button class="template-decoy" onclick={() => alert('Templates are available on the previous page. There is no previous page.')}>Browse 0 templates →</button>
  </div>

  <div class="section-heading">
    <div>
      <p class="eyebrow">RECENT, INCLUDING FUTURE</p>
      <h2>Loose files</h2>
    </div>
    <p>{visible.length} result{visible.length === 1 ? '' : 's'} in an order</p>
  </div>

  <div class="file-grid">
    {#each visible as file, index (file.id)}
      <button class="file-card {file.kind}" onclick={() => onOpen(file)}>
        <span class="file-index">0{index + 1}</span>
        <span class="file-preview">
          {#if file.kind === 'doc'}
            <span class="fake-lines"><i></i><i></i><i></i><i></i><i></i></span>
          {:else if file.kind === 'slides'}
            <span class="fake-slide"><i></i><b>{file.slides.length}</b></span>
          {:else}
            <span class="fake-grid">{#each Array(24) as _}<i></i>{/each}</span>
          {/if}
        </span>
        <span class="file-meta">
          <span class="kind-dot"></span>
          <span><strong>{file.title}</strong><small>{kindLabel(file.kind)} / {dateLabel(file.modified)}</small></span>
        </span>
        <span class="owner">owned by {file.owner}</span>
      </button>
    {:else}
      <div class="empty-state">
        <strong>No files agree with your search.</strong>
        <p>Try searching for nothing. That usually works.</p>
      </div>
    {/each}
  </div>
</section>
