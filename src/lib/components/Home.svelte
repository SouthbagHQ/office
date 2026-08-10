<script lang="ts">
  import type { DialogRequest } from '$lib/dialog';
  import type { Kind, OfficeFile } from '$lib/workspace';
  import { kindLabel } from '$lib/workspace';

  export let files: OfficeFile[];
  export let query: string;
  export let onOpen: (file: OfficeFile) => void;
  export let onCreate: (kind: Kind) => void;
  export let onDelete: (file: OfficeFile) => void;
  export let onDeleteAll: () => void;
  export let onDialog: (request: DialogRequest) => void;

  let openMenu: string | null = null;
  let ascending = false;
  $: visible = (query ? [] : files)
    .slice()
    .sort((left, right) => (ascending ? 1 : -1) * (new Date(left.modified).getTime() - new Date(right.modified).getTime()));

  function dateLabel(value: string) {
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(
      new Date(value)
    );
  }

  function remove(file: OfficeFile) {
    openMenu = null;
    onDelete(file);
  }

  function requestCreation(kind: Kind) {
    const label = kind === 'doc' ? 'document' : kind === 'slides' ? 'presentation' : 'spreadsheet';
    onDialog({
      title: `Create new ${label}?`,
      message: `A blank ${label} will be created in your cloud workspace.`,
      confirmLabel: 'Create',
      cancelLabel: 'Cancel',
      onConfirm: () => onCreate(kind)
    });
  }
</script>

<section class="home-view">
  <div class="creation-zone" aria-label="Create a file">
    <button class="create-card docs" onclick={() => requestCreation('doc')}>
      <span class="paper-icon">¶</span><strong>New document</strong><small>Docs</small>
    </button>
    <button class="create-card slides" onclick={() => requestCreation('slides')}>
      <span class="paper-icon">▱</span><strong>New presentation</strong><small>Slides</small>
    </button>
    <button class="create-card sheets" onclick={() => requestCreation('sheet')}>
      <span class="paper-icon">⌗</span><strong>New spreadsheet</strong><small>Sheets</small>
    </button>
  </div>

  <div class="file-controls">
    <button class="delete-all-files" disabled={!files.length} onclick={onDeleteAll}>Delete all files</button>
    <button aria-label={ascending ? 'Newest first' : 'Oldest first'} onclick={() => (ascending = !ascending)}>↕</button>
    <span>{visible.length}</span>
  </div>

  <div class="file-grid">
    {#each visible as file (file.id)}
      <article class="file-card {file.kind}">
        <button class="file-open" onclick={() => onOpen(file)} aria-label={`Open ${file.title}`}>
          <span class="file-preview">
            {#if file.kind === 'doc'}
              <span class:empty={!file.content} class="fake-lines">
                {#if file.content}<i></i><i></i><i></i><i></i><i></i>{/if}
              </span>
            {:else if file.kind === 'slides'}
              <span class="fake-slide">{#if file.slides.some((slide) => slide.title || slide.body)}<i></i>{/if}</span>
            {:else}
              <span class:populated={Object.keys(file.cells).length > 0} class="fake-grid">{#each Array(24) as _}<i></i>{/each}</span>
            {/if}
          </span>
          <span class="file-meta">
            <span class="kind-dot"></span>
            <span><strong>{file.title}</strong><small>{kindLabel(file.kind)} · {dateLabel(file.modified)}</small></span>
          </span>
        </button>
        <button
          class="file-menu-button"
          aria-label={`Actions for ${file.title}`}
          aria-expanded={openMenu === file.id}
          onclick={() => (openMenu = openMenu === file.id ? null : file.id)}
        >•••</button>
        {#if openMenu === file.id}
          <div class="file-menu">
            <button onclick={() => remove(file)}>Delete</button>
          </div>
        {/if}
      </article>
    {:else}
      <div class="empty-state" class:search-error={Boolean(query)} role="alert">
        <p>{query ? 'Nothing found' : 'No files'}</p>
      </div>
    {/each}
  </div>
</section>
