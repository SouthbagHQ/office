<script lang="ts">
  import EditableText from './EditableText.svelte';
  import type { DialogRequest } from '$lib/dialog';
  import { normalizeKevin } from '$lib/kevin';
  import type { Slide, SlideFile } from '$lib/workspace';
  import { track } from '$lib/palantir';

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
    track('office_slide_added', { slides: slides.length });
  }

  function duplicateSlide(source = 'toolbar') {
    const slides = [...file.slides];
    slides.splice(selected, 0, { ...slides[selected] });
    onChange({ ...file, slides, modified: new Date().toISOString() });
    track('office_slide_duplicated', { slides: slides.length, index: selected, source });
  }

  function removeSlide() {
    if (file.slides.length === 1) {
      track('office_slide_delete_blocked');
      onDialog({ title: 'Slide required', message: 'A presentation must contain at least one slide.' });
      return;
    }
    const slides = file.slides.filter((_, index) => index !== selected);
    onChange({ ...file, slides, modified: new Date().toISOString() });
    selected = Math.max(0, selected - 1);
    track('office_slide_deleted', { slides: slides.length, index: selected });
  }

  function setLayout(layout: Slide['layout'], label: string) {
    updateSlide({ layout });
    track('office_slide_layout_changed', { layout, label, index: selected });
  }

  function setTheme(theme: number, source: string) {
    onChange({ ...file, theme, modified: new Date().toISOString() });
    track('office_slides_theme_changed', { theme, source });
  }

  function cycleTheme(source = 'toolbar') {
    setTheme((file.theme + 1) % 3, source);
  }

  function selectSlide(index: number, source: string) {
    selected = index;
    track('office_slide_selected', { index, slides: file.slides.length, source });
  }

  function togglePanel(source: string) {
    panel = panel === 'design' ? 'nothing' : 'design';
    track('office_slides_panel_toggled', { open: panel === 'design', source });
  }

  function present(source: string) {
    presenting = true;
    track('office_slides_presented', { slides: file.slides.length, from_slide: selected, source });
  }

  function exitPresentation() {
    presenting = false;
    track('office_slides_presentation_exited', { at_slide: selected, slides: file.slides.length });
  }

  function step(direction: 'previous' | 'next') {
    const next = direction === 'previous' ? Math.max(0, selected - 1) : Math.min(file.slides.length - 1, selected + 1);
    const moved = next !== selected;
    selected = next;
    track('office_slides_navigated', { direction, index: selected, moved });
  }

  function menu(name: string, action: () => void) {
    track('office_slides_menu', { menu: name });
    action();
  }
</script>

<section class="editor slides-editor theme-{file.theme}">
  <header class="editor-titlebar slides-titlebar">
    <button class="exit-button slides-mark" onclick={onExit} aria-label="Back to files">▰</button>
    <div class="title-stack">
      <input class="file-title-input" aria-label="Presentation title" value={file.title} oninput={(event) => onChange({ ...file, title: normalizeKevin(event.currentTarget.value), modified: new Date().toISOString() })} onchange={(event) => track('office_file_renamed', { kind: 'slides', title_length: event.currentTarget.value.length })} />
      <nav class="menu-strip" aria-label="Presentation menus">
        <button onclick={() => menu('file', () => onDialog({ title: 'File', message: 'This presentation saves automatically to the Southbag Cloud.' }))}>File</button><button onclick={() => menu('edit', () => duplicateSlide('edit_menu'))}>Edit</button><button onclick={() => menu('theme', () => cycleTheme('theme_menu'))}>Theme</button><button onclick={() => menu('view', () => togglePanel('view_menu'))}>View</button>
      </nav>
    </div>
    <span class="save-state">▲ Saved</span>
    <button class="export-button" onclick={() => onExport(file)}>Export presentation</button>
    <button class="present-button" onclick={() => present('titlebar')}>Present ▶</button>
  </header>

  <div class="toolbar slides-toolbar">
    <button class="new-slide-button" onclick={addSlide}><span>＋</span> New slide</button>
    <button onclick={() => duplicateSlide()}>▱ Duplicate</button><button onclick={removeSlide}>Delete slide</button>
    <span class="toolbar-divider"></span>
    <button onclick={() => setLayout('title', 'Layout B')}>Layout B</button>
    <button onclick={() => setLayout('split', 'Single column')}>Single column</button>
    <button class="tiny-action" onclick={() => cycleTheme('tasteful_design')}>apply tasteful design</button>
    <button onclick={() => (track('office_slides_transitions_opened'), onDialog({ title: 'Transitions', message: 'No slide transitions are currently applied.' }))}>Motion sickness</button>
  </div>

  <div class="slides-workspace">
    <aside class="slide-rail" aria-label="Slide thumbnails">
      <button class="rail-collapse" onclick={() => (track('office_slides_rail_collapse_attempted'), onDialog({ title: 'Slide rail', message: 'Slide thumbnails remain visible while editing.' }))}>›</button>
      {#each file.slides as item, index}
        <button class:active={index === selected} class="slide-thumb-button" onclick={() => selectSlide(index, 'rail')}>
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
        <textarea value={file.notes} oninput={(event) => onChange({ ...file, notes: normalizeKevin(event.currentTarget.value), modified: new Date().toISOString() })} onchange={(event) => track('office_slides_notes_edited', { notes_length: event.currentTarget.value.length })}></textarea>
      </label>
    </main>

    {#if panel === 'design'}
      <aside class="design-panel">
        <header><strong>DESIGN PANIC</strong><button onclick={() => togglePanel('panel_close')}>＋</button></header>
        <p>Choose the theme already chosen.</p>
        <button class="theme-swatch swatch-0" onclick={() => setTheme(0, 'swatch')}>Compliance</button>
        <button class="theme-swatch swatch-1" onclick={() => setTheme(1, 'swatch')}>Boardroom bruise</button>
        <button class="theme-swatch swatch-2" onclick={() => setTheme(2, 'swatch')}>Printer warning</button>
        <label>Apply to <select onchange={(event) => track('office_slides_apply_to_changed', { choice: event.currentTarget.value })}><option>slides not selected</option><option>the current past</option></select></label>
      </aside>
    {/if}
  </div>

  <footer class="editor-status"><span>SLIDE {selected + 1} OF {file.slides.length}</span><span>Not checked for spelling</span><span class="status-grow"></span><button onclick={() => present('status_bar')}>▣ Presenter confusion</button></footer>

  {#if presenting}
    <div class="presentation-overlay" role="dialog" aria-modal="true" aria-label="Presentation mode">
      <button class="close-presentation" onclick={exitPresentation}>Exit presentation ×</button>
      <div class="slide-stage layout-{slide.layout}">
        <div class="slide-accent"></div>
        <div class="slide-copy"><div class="slide-title">{slide.title}</div><div class="slide-body">{slide.body}</div></div>
        <span class="slide-folio">{selected + 1}</span>
      </div>
      <div class="presentation-controls">
        <button onclick={() => step('previous')}>← Previous</button>
        <span>{selected + 1} / {file.slides.length}</span>
        <button onclick={() => step('next')}>Next →</button>
      </div>
    </div>
  {/if}
</section>
