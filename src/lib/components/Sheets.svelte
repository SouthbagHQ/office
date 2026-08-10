<script lang="ts">
  import type { DialogRequest } from '$lib/dialog';
  import type { SheetFile } from '$lib/workspace';
  import { cellName, evaluateCell } from '$lib/sheet';

  export let file: SheetFile;
  export let onChange: (file: SheetFile) => void;
  export let onExit: () => void;
  export let onDialog: (request: DialogRequest) => void;

  const columns = Array.from({ length: 9 }, (_, index) => String.fromCharCode(65 + index));
  const rows = Array.from({ length: 18 }, (_, index) => index + 1);
  let selected = 'B2';
  let showChart = Object.keys(file.cells).length > 0;
  let showRaw = false;

  $: selectedRaw = file.cells[selected] ?? '';

  function setCell(name: string, value: string) {
    onChange({ ...file, cells: { ...file.cells, [name]: value }, modified: new Date().toISOString() });
  }

</script>

<section class="editor sheets-editor">
  <header class="editor-titlebar sheets-titlebar">
    <button class="exit-button sheets-mark" onclick={onExit} aria-label="Back to files">▦</button>
    <div class="title-stack">
      <input class="file-title-input" aria-label="Spreadsheet title" value={file.title} oninput={(event) => onChange({ ...file, title: event.currentTarget.value, modified: new Date().toISOString() })} />
      <nav class="menu-strip" aria-label="Spreadsheet menus">
        <button onclick={() => onDialog({ title: 'File', message: 'This spreadsheet saves automatically to your cloud workspace.' })}>File</button><button onclick={() => onDialog({ title: 'Edit cells', message: 'Select a cell, then type in the cell or formula bar.' })}>Edit</button><button onclick={() => (showRaw = !showRaw)}>{showRaw ? 'Show values' : 'Show formulas'}</button><button onclick={() => (showChart = !showChart)}>{showChart ? 'Hide chart' : 'Show chart'}</button>
      </nav>
    </div>
    <span class="save-state">◆ Saved</span>
    <a class="share-button sheets-share" href="mailto:?subject=Cell attachment&body=Please see cell B2 attached mentally.">Restrict access</a>
  </header>

  <div class="toolbar sheet-toolbar">
    <button onclick={() => onDialog({ title: 'Print', message: 'Use the browser print command to print this spreadsheet.' })}>▣</button><button onclick={() => onDialog({ title: 'Undo', message: 'Undo is not available for the current cell.' })}>↷</button>
    <select aria-label="Format"><option>Money without currency</option><option>Text as date</option><option>Number-shaped text</option></select>
    <button onclick={() => setCell(selected, `$${selectedRaw}`)}>$</button><button onclick={() => setCell(selected, `${selectedRaw}%`)}>%</button><button onclick={() => setCell(selected, `=${selectedRaw || '0'}*2`)}>.0←</button>
    <span class="toolbar-divider"></span><button class="tiny-action" onclick={() => onDialog({ title: 'Cell formatting', message: 'Cell borders are hidden in this workspace.' })}>remove more borders</button><button onclick={() => (showChart = true)}>T</button>
  </div>

  <div class="formula-bar">
    <button class="name-box" onclick={() => (selected = 'A1')}>{selected === 'A1' ? 'B2' : selected}</button>
    <span class="fx">𝑓<sub>x</sub></span>
    <input aria-label="Formula bar" value={selectedRaw} oninput={(event) => setCell(selected, event.currentTarget.value)} placeholder="Enter a formula in the cell, or a cell in the formula" />
  </div>

  <div class="sheet-area">
    <div class="grid-scroller">
      <table class="spreadsheet">
        <thead><tr><th class="corner">☰</th>{#each columns as column}<th>{column}</th>{/each}</tr></thead>
        <tbody>
          {#each rows as row}
            <tr><th>{row}</th>
              {#each columns as _column, columnIndex}
                {@const name = cellName(columnIndex + 1, row)}
                <td class:selected={selected === name} onclick={() => (selected = name)}>
                  <input
                    aria-label={`Cell ${name}`}
                    value={showRaw ? file.cells[name] ?? '' : evaluateCell(name, file.cells)}
                    onfocus={() => (selected = name)}
                    oninput={(event) => setCell(name, event.currentTarget.value)}
                  />
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    {#if showChart}
      <aside class="chart-panel">
        <header><strong>RECOMMENDED INTERRUPTION</strong><button onclick={() => (showChart = false)}>＋</button></header>
        <div class="chart-bars"><i style="height: 41%"></i><i style="height: 77%"></i><i style="height: 29%"></i><i style="height: 88%"></i><i style="height: 55%"></i></div>
        <p>Chart of cells we did not inspect</p><small>Confidence / sandwiches / fiscal feelings</small>
      </aside>
    {/if}
  </div>

  <div class="sheet-tabs"><button class="active">Sheet 1</button><span></span></div>
  <footer class="editor-status"><span>{Object.keys(file.cells).length ? `SUM: ${evaluateCell('E6', file.cells) || '—'}` : 'READY'}</span><span>SELECTED: {selected}</span><span class="status-grow"></span><span>100%</span><input aria-label="Zoom" type="range" min="50" max="150" value="100" /></footer>
</section>
