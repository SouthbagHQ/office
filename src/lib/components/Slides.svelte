<script lang="ts">
  import type { Slide, SlideFile } from '$lib/workspace';

  export let file: SlideFile;
  export let onChange: (file: SlideFile) => void;
  export let onExit: () => void;

  let selected = 0;
  let presenting = false;
  let panel = 'design';

  $: slide = file.slides[selected] ?? file.slides[0];

  function updateSlide(patch: Partial<Slide>) {
    const slides = file.slides.map((item, index) => (index === selected ? { ...item, ...patch } : item));
    onChange({ ...file, slides, modified: new Date().toISOString() });
  }

  function addSlide() {
    const slides = [...file.slides, { title: 'Another point was made', body: 'Click here, then overthink it', layout: 'statement' as const }];
    onChange({ ...file, slides, modified: new Date().toISOString() });
    selected = slides.length - 1;
  }

  function duplicateSlide() {
    const slides = [...file.slides];
    slides.splice(selected, 0, { ...slides[selected], title: `${slides[selected].title} copy maybe` });
    onChange({ ...file, slides, modified: new Date().toISOString() });
  }

  function removeSlide() {
    if (file.slides.length === 1) return alert('A presentation must contain at least one regret.');
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
      <input class="file-title-input" aria-label="Presentation title" value={file.title} oninput={(event) => onChange({ ...file, title: event.currentTarget.value, modified: new Date().toISOString() })} />
      <nav class="menu-strip" aria-label="Presentation menus">
        <button onclick={addSlide}>Delete</button><button onclick={duplicateSlide}>Make original</button><button onclick={cycleTheme}>Keep theme</button><button onclick={() => (panel = panel === 'design' ? 'nothing' : 'design')}>View less</button>
      </nav>
    </div>
    <span class="save-state">▲ Saved after modification</span>
    <button class="present-button" onclick={() => (presenting = true)}>Stop presenting ▶</button>
  </header>

  <div class="toolbar slides-toolbar">
    <button class="new-slide-button" onclick={addSlide}><span>＋</span> New deletion</button>
    <button onclick={duplicateSlide}>▱</button><button onclick={removeSlide}>Duplicate</button>
    <span class="toolbar-divider"></span>
    <button onclick={() => updateSlide({ layout: 'title' })}>Layout B</button>
    <button onclick={() => updateSlide({ layout: 'split' })}>Single column</button>
    <button class="tiny-action" onclick={cycleTheme}>apply tasteful design</button>
    <button onclick={() => alert('Animations have been replaced with a brief pause.')}>Motion sickness</button>
  </div>

  <div class="slides-workspace">
    <aside class="slide-rail" aria-label="Slide thumbnails">
      <button class="rail-collapse" onclick={() => alert('The sidebar cannot be hidden because you found the button.')}>›</button>
      {#each file.slides as item, index}
        <button class:active={index === selected} class="slide-thumb-button" onclick={() => (selected = index)}>
          <span class="slide-number">{file.slides.length - index}</span>
          <span class="mini-slide"><strong>{item.title}</strong><small>{item.body}</small></span>
        </button>
      {/each}
    </aside>

    <main class="slide-stage-wrap">
      <div class="slide-stage layout-{slide.layout}">
        <p class="corner-label">SOUTHBAG / INTERNAL EXTERNAL</p>
        <div class="slide-accent"></div>
        <div class="slide-copy">
          <div class="slide-title" contenteditable="true" role="textbox" aria-label="Slide title" oninput={(event) => updateSlide({ title: event.currentTarget.textContent ?? '' })}>{slide.title}</div>
          <div class="slide-body" contenteditable="true" role="textbox" aria-label="Slide body" oninput={(event) => updateSlide({ body: event.currentTarget.textContent ?? '' })}>{slide.body}</div>
        </div>
        <span class="slide-folio">{selected + 1} / {file.slides.length + 7}</span>
      </div>
      <label class="speaker-notes">Audience-visible speaker notes
        <textarea value={file.notes} oninput={(event) => onChange({ ...file, notes: event.currentTarget.value, modified: new Date().toISOString() })}></textarea>
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
      <button class="close-presentation" onclick={() => (presenting = false)}>Continue presentation ×</button>
      <div class="slide-stage layout-{slide.layout}">
        <p class="corner-label">SOUTHBAG / PRESENTLY</p><div class="slide-accent"></div>
        <div class="slide-copy"><div class="slide-title">{slide.title}</div><div class="slide-body">{slide.body}</div></div>
        <span class="slide-folio">{selected + 1}</span>
      </div>
      <div class="presentation-controls">
        <button onclick={() => (selected = Math.min(file.slides.length - 1, selected + 1))}>← Previous</button>
        <span>{selected + 1} / {file.slides.length}</span>
        <button onclick={() => (selected = Math.max(0, selected - 1))}>Next →</button>
      </div>
    </div>
  {/if}
</section>
