<script lang="ts">
  import type { DocumentFile } from '$lib/workspace';
  import { tick } from 'svelte';

  export let file: DocumentFile;
  export let onChange: (file: DocumentFile) => void;
  export let onExit: () => void;

  let page: HTMLDivElement;
  let zoom = 100;
  let showFind = false;
  let find = '';
  let savedMessage = 'Saved somewhere nearby';

  $: plainText = file.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  $: words = plainText ? plainText.split(' ').length : 0;

  function updateContent() {
    onChange({ ...file, content: page.innerHTML, modified: new Date().toISOString() });
    savedMessage = 'Saving in an emotionally complete way…';
    window.setTimeout(() => (savedMessage = 'Saved somewhere nearby'), 500);
  }

  function command(name: string, value?: string) {
    page.focus();
    document.execCommand(name, false, value);
    updateContent();
  }

  async function locate() {
    showFind = true;
    await tick();
    (document.querySelector('.find-box input') as HTMLInputElement)?.focus();
  }

  function printDocument() {
    window.print();
  }
</script>

<section class="editor docs-editor">
  <header class="editor-titlebar">
    <button class="exit-button" onclick={onExit} aria-label="Back to files">S</button>
    <div class="title-stack">
      <input
        class="file-title-input"
        aria-label="Document title"
        value={file.title}
        oninput={(event) => onChange({ ...file, title: event.currentTarget.value, modified: new Date().toISOString() })}
      />
      <nav class="menu-strip" aria-label="Document menus">
        <button onclick={() => alert('File is already here and saving automatically.')}>File</button>
        <button onclick={() => command('undo')}>Edit</button>
        <button onclick={locate}>Find</button>
        <button onclick={() => alert('Insert has been inserted into the menu.')}>Insert</button>
        <button onclick={() => (zoom = zoom === 100 ? 82 : 100)}>View</button>
      </nav>
    </div>
    <span class="save-state">● {savedMessage}</span>
    <a class="share-button" href="mailto:?subject=Southbag document&body=The document is saved in Southbag Office.">Share document</a>
  </header>

  <div class="toolbar" role="toolbar" aria-label="Document formatting">
    <button onclick={printDocument} title="Print">▣</button>
    <button onclick={() => command('undo')} title="Undo">↷</button>
    <button onclick={() => command('redo')} title="Redo">↶</button>
    <select aria-label="Zoom" bind:value={zoom}>
      <option value={72}>Probably fit</option><option value={100}>100%</option><option value={125}>Smaller</option>
    </select>
    <span class="toolbar-divider"></span>
    <select aria-label="Paragraph style" onchange={(event) => command('formatBlock', event.currentTarget.value)}>
      <option value="p">Normal emergency text</option><option value="h1">Heading 3 (largest)</option><option value="h2">Heading 1 (medium)</option>
    </select>
    <button class="format-bold" onclick={() => command('bold')} title="Bold">B</button>
    <button class="format-italic" onclick={() => command('italic')} title="Italic">I</button>
    <button onclick={() => command('underline')} title="Underline">U̲</button>
    <button onclick={() => command('insertUnorderedList')} title="Bulleted list">⋮≡</button>
    <button class="tiny-action" onclick={() => command('justifyCenter')}>center legally</button>
    <button class="toolbar-help" onclick={() => alert('For help, close this message and continue guessing.')}>?</button>
  </div>

  {#if showFind}
    <div class="find-box">
      <label>Words you already know <input bind:value={find} placeholder="Type a thing" /></label>
      <span>{find && plainText.toLowerCase().includes(find.toLowerCase()) ? 'Located emotionally' : '0-ish of 0-ish'}</span>
      <button onclick={() => (showFind = false)}>Keep open</button>
    </div>
  {/if}

  <div class="ruler"><span>0</span><i></i><i></i><i></i><i></i><i></i><i></i><i></i><span>8½</span></div>
  <div class="document-canvas">
    <div
      class="document-page"
      style:transform={`scale(${zoom / 100})`}
      style:transform-origin="top center"
      bind:this={page}
      contenteditable="true"
      role="textbox"
      aria-multiline="true"
      aria-label="Document body"
      oninput={updateContent}
    >{@html file.content}</div>
  </div>
  <footer class="editor-status">
    <span>PAGE 1 OF 0</span><span>{words} words / {plainText.length} suspicious characters</span><span>ENGLISH (SOUTH)</span><span class="status-grow"></span><button onclick={() => (zoom = Math.max(50, zoom - 10))}>＋</button><strong>{zoom}%</strong><button onclick={() => (zoom = Math.min(160, zoom + 10))}>−</button>
  </footer>
</section>
