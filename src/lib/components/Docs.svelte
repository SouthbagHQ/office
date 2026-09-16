<script lang="ts">
  import type { DialogRequest } from '$lib/dialog';
  import { sanitizeDocumentHtml } from '$lib/document-html';
  import { normalizeKevin, normalizeKevinText } from '$lib/kevin';
  import type { DocumentFile } from '$lib/workspace';
  import { tick } from 'svelte';
  import { track } from '$lib/palantir';

  export let file: DocumentFile;
  export let onChange: (file: DocumentFile) => void;
  export let onExit: () => void;
  export let onDialog: (request: DialogRequest) => void;
  export let onExport: (file: DocumentFile) => void;

  const initialContent = sanitizeDocumentHtml(file.content);
  let page: HTMLDivElement;
  let zoom = 100;
  let showFind = false;
  let find = '';
  let savedMessage = 'Saved';

  $: plainText = file.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  $: words = plainText ? plainText.split(' ').length : 0;

  function updateContent() {
    normalizeKevinText(page);
    const content = sanitizeDocumentHtml(page.innerHTML);
    onChange({ ...file, content, modified: new Date().toISOString() });
    savedMessage = 'Saving…';
    window.setTimeout(() => (savedMessage = 'Saved'), 500);
  }

  function insertTransferredContent(transfer: DataTransfer | null) {
    const richContent = transfer?.getData('text/html') ?? '';
    if (richContent) document.execCommand('insertHTML', false, sanitizeDocumentHtml(richContent));
    else document.execCommand('insertText', false, transfer?.getData('text/plain') ?? '');
    updateContent();
  }

  function pasteContent(event: ClipboardEvent) {
    event.preventDefault();
    track('office_doc_pasted', { rich: Boolean(event.clipboardData?.getData('text/html')), words });
    insertTransferredContent(event.clipboardData);
  }

  function dropContent(event: DragEvent) {
    event.preventDefault();
    page.focus();
    track('office_doc_dropped', { rich: Boolean(event.dataTransfer?.getData('text/html')), words });
    insertTransferredContent(event.dataTransfer);
  }

  function command(name: string, value?: string) {
    page.focus();
    document.execCommand(name, false, value);
    updateContent();
    track('office_format', { editor: 'doc', action: name, ...(value ? { value } : {}), words });
  }

  function moveCursor(direction: 'forward' | 'backward', granularity: 'character' | 'word' | 'sentence' | 'line') {
    page.focus();
    getSelection()?.modify('move', direction, granularity);
    track('office_doc_cursor_moved', { direction, granularity });
  }

  async function locate() {
    showFind = true;
    track('office_doc_find_opened', { words });
    await tick();
    (document.querySelector('.find-box input') as HTMLInputElement)?.focus();
  }

  function printDocument() {
    track('office_doc_print', { words });
    window.print();
  }

  function setZoom(next: number, source: string) {
    zoom = next;
    track('office_doc_zoom_changed', { zoom, source });
  }

  function menu(name: string, action: () => void) {
    track('office_doc_menu', { menu: name });
    action();
  }

  function renameDocument(title: string) {
    track('office_file_renamed', { kind: 'doc', title_length: title.length });
  }

  let findTimer: number | undefined;
  function findTyped(value: string) {
    find = normalizeKevin(value);
    if (findTimer) window.clearTimeout(findTimer);
    if (!find) return;
    findTimer = window.setTimeout(
      () => track('office_doc_find', { query_length: find.length, found: plainText.toLowerCase().includes(find.toLowerCase()) }),
      800
    );
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
        oninput={(event) => onChange({ ...file, title: normalizeKevin(event.currentTarget.value), modified: new Date().toISOString() })}
        onchange={(event) => renameDocument(event.currentTarget.value)}
      />
      <nav class="menu-strip" aria-label="Document menus">
        <button onclick={() => menu('file', () => onDialog({ title: 'File', message: 'This document saves automatically to the Southbag cloud' }))}>File</button>
        <button onclick={() => menu('edit', () => command('undo'))}>Edit</button>
        <button onclick={() => menu('find', locate)}>Find</button>
        <button onclick={() => menu('insert', () => onDialog({ title: 'Insert', message: 'Choose a formatting control from the toolbar.' }))}>Insert</button>
        <button onclick={() => menu('view', () => setZoom(zoom === 100 ? 82 : 100, 'view_menu'))}>View</button>
      </nav>
    </div>
    <span class="save-state">● {savedMessage}</span>
    <button class="export-button" onclick={() => onExport(file)}>Export document</button>
  </header>

  <div class="toolbar" role="toolbar" aria-label="Document formatting">
    <button onclick={printDocument} title="Print">▣</button>
    <button onclick={() => command('undo')} title="Undo">↷</button>
    <button onclick={() => command('redo')} title="Redo">↶</button>
    <button onclick={() => moveCursor('backward', 'sentence')} title="Previous sentence">↖</button>
    <button onclick={() => moveCursor('backward', 'line')} title="Previous line">↑</button>
    <button onclick={() => moveCursor('backward', 'word')} title="Previous word">↗</button>
    <button onclick={() => moveCursor('backward', 'character')} title="Previous character">←</button>
    <button onclick={() => moveCursor('forward', 'character')} title="Next character">→</button>
    <button onclick={() => moveCursor('forward', 'word')} title="Next word">↙</button>
    <button onclick={() => moveCursor('forward', 'line')} title="Next line">↓</button>
    <button onclick={() => moveCursor('forward', 'sentence')} title="Next sentence">↘</button>
    <select aria-label="Zoom" value={zoom} onchange={(event) => setZoom(Number(event.currentTarget.value), 'zoom_select')}>
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
    <button class="toolbar-help" onclick={() => (track('office_doc_help_opened', { words }), onDialog({ title: 'Document help', message: 'Type on the page. Changes save automatically.' }))}>?</button>
  </div>

  {#if showFind}
    <div class="find-box">
      <label>Words you already know <input value={find} oninput={(event) => findTyped(event.currentTarget.value)} placeholder="Type a thing" /></label>
      <span>{find && plainText.toLowerCase().includes(find.toLowerCase()) ? 'Located emotionally' : '0-ish of 0-ish'}</span>
      <button onclick={() => (track('office_doc_find_closed'), (showFind = false))}>Keep open</button>
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
      tabindex="0"
      aria-multiline="true"
      aria-label="Document body"
      oninput={updateContent}
      onpaste={pasteContent}
      ondrop={dropContent}
    >{@html initialContent}</div>
  </div>
  <footer class="editor-status">
    <span>PAGE 1 OF 1</span><span>{words} words / {plainText.length} characters</span><span>ENGLISH</span><span class="status-grow"></span><button onclick={() => setZoom(Math.max(50, zoom - 10), 'status_minus')}>−</button><strong>{zoom}%</strong><button onclick={() => setZoom(Math.min(160, zoom + 10), 'status_plus')}>＋</button>
  </footer>
</section>
