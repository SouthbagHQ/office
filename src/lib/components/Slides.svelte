<script lang="ts">
  import EditableText from './EditableText.svelte';
  import type { DialogRequest } from '$lib/dialog';
  import { normalizeKevin } from '$lib/kevin';
  import type { Slide, SlideFile } from '$lib/workspace';

  export let file: SlideFile;
  export let onChange: (file: SlideFile) => void;
  export let onExit: () => void;
  export let onDialog: (request: DialogRequest) => void;
  export let onExport: (file: SlideFile) => void;

  let selected = 0;
  let presenting = false;
  let panel = 'design';

  $: slide = file.slides[selected] ?? file.slides[0];

  function updateSlide(patch: Partial<Slide>) {
    const slides = file.slides.map((item, index) => (index === selected ? { ...item, ...patch } : item));
    onChange({ ...file, slides, modified: new Date().toISOString() });
  }

  function addSlide() {
    const slides = [...file.slides, { title: '', body: '', layout: 'title' as const }];
    onChange({ ...file, slides, modified: new Date().toISOString() });
    selected = slides.length - 1;
  }

  function duplicateSlide() {
    const slides = [...file.slides];
    slides.splice(selected, 0, { ...slides[selected] });
    onChange({ ...file, slides, modified: new Date().toISOString() });
  }

  function removeSlide() {
    if (file.slides.length === 1) {
      onDialog({ title: 'Slide required', message: 'A presentation must contain at least one slide.' });
      return;
    }
    const slides = file.slides.filter((_, index) => index !== selected);
    onChange({ ...file, slides, modified: new Date().toISOString() });
    selected = Math.max(0, selected - 1);
  }

  function cycleTheme() {
    onChange({ ...file, theme: (file.theme + 1) % 3, modified: new Date().toISOString() });
  }
</script>

<section class="editor slides-editor theme-{file.theme}">
  <header class="editor-titlebar slides-titlebar">
    <button class="exit-button slides-mark" onclick={onExit} aria-label="Back to files">▰</button>
    <div class="title-stack">
      <input class="file-title-input" aria-label="Presentation title" value={file.title} oninput={(event) => onChange({ ...file, title: normalizeKevin(event.currentTarget.value), modified: new Date().toISOString() })} />
      <nav class="menu-strip" aria-label="Presentation menus">
        <button onclick={() => onDialog({ title: 'File', message: 'This presentation saves automatically to your cloud workspace.' })}>File</button><button onclick={duplicateSlide}>Edit</button><button onclick={cycleTheme}>Theme</button><button onclick={() => (panel = panel === 'design' ? 'nothing' : 'design')}>View</button>
      </nav>
    </div>
    <span class="save-state">▲ Saved</span>
    <button class="export-button" onclick={() => onExport(file)}>Export presentation</button>
    <button class="present-button" onclick={() => (presenting = true)}>Present ▶</button>
  </header>

  <div class="toolbar slides-toolbar">
    <button class="new-slide-button" onclick={addSlide}><span>＋</span> New slide</button>
    <button onclick={duplicateSlide}>▱ Duplicate</button><button onclick={removeSlide}>Delete slide</button>
    <span class="toolbar-divider"></span>
    <button onclick={() => updateSlide({ layout: 'title' })}>Layout B</button>
    <button onclick={() => updateSlide({ layout: 'split' })}>Single column</button>
    <button class="tiny-action" onclick={cycleTheme}>apply tasteful design</button>
    <button onclick={() => onDialog({ title: 'Transitions', message: 'No slide transitions are currently applied.' })}>Motion sickness</button>
  </div>

  <div class="slides-workspace">
    <aside class="slide-rail" aria-label="Slide thumbnails">
      <button class="rail-collapse" onclick={() => onDialog({ title: 'Slide rail', message: 'Slide thumbnails remain visible while editing.' })}>›</button>
      {#each file.slides as item, index}
        <button class:active={index === selected} class="slide-thumb-button" onclick={() => (selected = index)}>
          <span class="slide-number">{index + 1}</span>
          <span class="mini-slide"><strong>{item.title}</strong><small>{item.body}</small></span>
        </button>
      {/each}
    </aside>

    <main class="slide-stage-wrap">
      <div class="slide-stage layout-{slide.layout}">
        <div class="slide-accent"></div>
        {#key selected}
          <div class="slide-copy">
            <EditableText value={slide.title} className="slide-title" label="Slide title" onChange={(title) => updateSlide({ title })} />
            <EditableText value={slide.body} className="slide-body" label="Slide body" onChange={(body) => updateSlide({ body })} />
          </div>
        {/key}
        <span class="slide-folio">{selected + 1} / {file.slides.length}</span>
      </div>
      <label class="speaker-notes">Speaker notes
        <textarea value={file.notes} oninput={(event) => onChange({ ...file, notes: normalizeKevin(event.currentTarget.value), modified: new Date().toISOString() })}></textarea>
      </label>
    </main>

    {#if panel === 'design'}
      <aside class="design-panel">
        <header><strong>DESIGN PANIC</strong><button onclick={() => (panel = 'nothing')}>＋</button></header>
        <p>Choose the theme already chosen.</p>
        <button class="theme-swatch swatch-0" onclick={() => onChange({ ...file, theme: 0 })}>Compliance</button>
        <button class="theme-swatch swatch-1" onclick={() => onChange({ ...file, theme: 1 })}>Boardroom bruise</button>
        <button class="theme-swatch swatch-2" onclick={() => onChange({ ...file, theme: 2 })}>Printer warning</button>
        <label>Apply to <select><option>slides not selected</option><option>the current past</option></select></label>
      </aside>
    {/if}
  </div>

  <footer class="editor-status"><span>SLIDE {selected + 1} OF {file.slides.length}</span><span>Not checked for spelling</span><span class="status-grow"></span><button onclick={() => (presenting = true)}>▣ Presenter confusion</button></footer>

  {#if presenting}
    <div class="presentation-overlay" role="dialog" aria-modal="true" aria-label="Presentation mode">
      <button class="close-presentation" onclick={() => (presenting = false)}>Exit presentation ×</button>
      <div class="slide-stage layout-{slide.layout}">
        <div class="slide-accent"></div>
        <div class="slide-copy"><div class="slide-title">{slide.title}</div><div class="slide-body">{slide.body}</div></div>
        <span class="slide-folio">{selected + 1}</span>
      </div>
      <div class="presentation-controls">
        <button onclick={() => (selected = Math.max(0, selected - 1))}>← Previous</button>
        <span>{selected + 1} / {file.slides.length}</span>
        <button onclick={() => (selected = Math.min(file.slides.length - 1, selected + 1))}>Next →</button>
      </div>
    </div>
  {/if}
</section>
