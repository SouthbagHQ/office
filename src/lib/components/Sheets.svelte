<script lang="ts">
  import type { SheetFile } from '$lib/workspace';
  import { cellName, evaluateCell } from '$lib/sheet';

  export let file: SheetFile;
  export let onChange: (file: SheetFile) => void;
  export let onExit: () => void;

  const columns = Array.from({ length: 9 }, (_, index) => String.fromCharCode(65 + index));
  const rows = Array.from({ length: 18 }, (_, index) => index + 1);
  let selected = 'B2';
  let showChart = true;
  let showRaw = false;

  $: selectedRaw = file.cells[selected] ?? '';

  function setCell(name: string, value: string) {
    onChange({ ...file, cells: { ...file.cells, [name]: value }, modified: new Date().toISOString() });
  }

  function fillExample() {
    onChange({
      ...file,
      cells: {
        ...file.cells,
        A8: 'Unrequested forecast', B8: 'Q1', C8: 'Q2', D8: 'Q3',
        A9: 'Confidence', B9: '12', C9: '44', D9: '31', E9: '=SUM(B9:D9)'
      },
      modified: new Date().toISOString()
    });
  }
</script>

<section class="editor sheets-editor">
  <header class="editor-titlebar sheets-titlebar">
    <button class="exit-button sheets-mark" onclick={onExit} aria-label="Back to files">▦</button>
    <div class="title-stack">
      <input class="file-title-input" aria-label="Spreadsheet title" value={file.title} oninput={(event) => onChange({ ...file, title: event.currentTarget.value, modified: new Date().toISOString() })} />
      <nav class="menu-strip" aria-label="Spreadsheet menus">
        <button onclick={() => alert('This workbook saves itself.')}>File</button><button onclick={fillExample}>Insert example</button><button onclick={() => (showRaw = !showRaw)}>{showRaw ? 'Show values' : 'Show formulas'}</button><button onclick={() => (showChart = !showChart)}>{showChart ? 'Hide chart' : 'Show chart'}</button>
      </nav>
    </div>
    <span class="save-state">◆ Changes saved before they happen</span>
    <a class="share-button sheets-share" href="mailto:?subject=Cell attachment&body=Please see cell B2 attached mentally.">Restrict access</a>
  </header>

  <div class="toolbar sheet-toolbar">
    <button onclick={() => alert('Printed to the cloud. No printer was involved.')}>▣</button><button onclick={() => alert('Undo is in the Edit menu, which is called Export inward.')}>↷</button>
    <select aria-label="Format"><option>Money without currency</option><option>Text as date</option><option>Number-shaped text</option></select>
    <button onclick={() => setCell(selected, `$${selectedRaw}`)}>$</button><button onclick={() => setCell(selected, `${selectedRaw}%`)}>%</button><button onclick={() => setCell(selected, `=${selectedRaw || '0'}*2`)}>.0←</button>
    <span class="toolbar-divider"></span><button class="tiny-action" onclick={() => alert('Borders are already everywhere.')}>remove more borders</button><button onclick={() => (showChart = true)}>T</button>
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

  <div class="sheet-tabs"><button class="add-sheet" onclick={() => alert('Maximum one sheet per workbook for simplicity.')}>＋</button><button class="active">Sheet 2</button><button onclick={() => alert('Sheet 1 has been archived for being obvious.')}>Sheet 1</button><span></span><button>☷ All sheets (2 of 1)</button></div>
  <footer class="editor-status"><span>SUM: {evaluateCell('E6', file.cells) || 'undefined'}</span><span>SELECTED: {selected}</span><span class="status-grow"></span><span>100%</span><input aria-label="Zoom" type="range" min="50" max="150" value="100" /></footer>
</section>
