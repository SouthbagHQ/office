<script lang="ts">
  import type { DialogRequest } from '$lib/dialog';
  import { normalizeKevin } from '$lib/kevin';
  import type { SheetFile } from '$lib/workspace';
  import { cellName, evaluateCell } from '$lib/sheet';
  import { track } from '$lib/palantir';

  export let file: SheetFile;
  export let onChange: (file: SheetFile) => void;
  export let onExit: () => void;
  export let onDialog: (request: DialogRequest) => void;
  export let onExport: (file: SheetFile) => void;

  const columns = Array.from({ length: 9 }, (_, index) => String.fromCharCode(65 + index));
  const rows = Array.from({ length: 18 }, (_, index) => index + 1);
  let selected = 'B2';
  let showChart = Object.keys(file.cells).length > 0;
  let showRaw = false;

  $: selectedRaw = file.cells[selected] ?? '';

  function setCell(name: string, value: string) {
    onChange({ ...file, cells: { ...file.cells, [name]: normalizeKevin(value) }, modified: new Date().toISOString() });
  }

  // Fires on commit (blur/enter), not per keystroke.
  function cellCommitted(name: string, value: string, source: 'cell' | 'formula_bar') {
    const formula = value.startsWith('=');
    track(formula ? 'office_sheet_formula_entered' : 'office_sheet_cell_edited', {
      cell: name,
      source,
      value_length: value.length,
      empty: value === '',
      filled_cells: Object.keys(file.cells).filter((key) => file.cells[key] !== '').length
    });
  }

  function applyFormat(action: string, next: string) {
    setCell(selected, next);
    track('office_format', { editor: 'sheet', action, cell: selected });
  }

  function selectCell(name: string, source: string) {
    if (selected === name) return;
    selected = name;
    track('office_sheet_cell_selected', { cell: name, source });
  }

  function toggleChart(source: string) {
    showChart = !showChart;
    track('office_sheet_chart_toggled', { open: showChart, source });
  }

  function toggleRaw() {
    showRaw = !showRaw;
    track('office_sheet_view_toggled', { view: showRaw ? 'formulas' : 'values' });
  }

  function menu(name: string, action: () => void) {
    track('office_sheet_menu', { menu: name });
    action();
  }

</script>

<section class="editor sheets-editor">
  <header class="editor-titlebar sheets-titlebar">
    <button class="exit-button sheets-mark" onclick={onExit} aria-label="Back to files">▦</button>
    <div class="title-stack">
      <input class="file-title-input" aria-label="Spreadsheet title" value={file.title} oninput={(event) => onChange({ ...file, title: normalizeKevin(event.currentTarget.value), modified: new Date().toISOString() })} onchange={(event) => track('office_file_renamed', { kind: 'sheet', title_length: event.currentTarget.value.length })} />
      <nav class="menu-strip" aria-label="Spreadsheet menus">
        <button onclick={() => menu('file', () => onDialog({ title: 'File', message: 'This spreadsheet saves automatically to the Southbag cloud.' }))}>File</button><button onclick={() => menu('edit', () => onDialog({ title: 'Edit cells', message: 'Select a cell, then type in the cell or formula bar.' }))}>Edit</button><button onclick={() => menu('view', toggleRaw)}>{showRaw ? 'Show values' : 'Show formulas'}</button><button onclick={() => menu('chart', () => toggleChart('menu'))}>{showChart ? 'Hide chart' : 'Show chart'}</button>
      </nav>
    </div>
    <span class="save-state">◆ Saved</span>
    <button class="export-button" onclick={() => onExport(file)}>Export spreadsheet</button>
  </header>

  <div class="toolbar sheet-toolbar">
    <button onclick={() => (track('office_sheet_print_attempted'), onDialog({ title: 'Print', message: 'Use the browser print command to print this spreadsheet.' }))}>▣</button><button onclick={() => (track('office_sheet_undo_attempted', { cell: selected }), onDialog({ title: 'Undo', message: 'Undo is not available for the current cell.' }))}>↷</button>
    <select aria-label="Format" onchange={(event) => track('office_format', { editor: 'sheet', action: 'number_format', value: event.currentTarget.value, cell: selected })}><option>Money without currency</option><option>Text as date</option><option>Number-shaped text</option></select>
    <button onclick={() => applyFormat('currency', `$${selectedRaw}`)}>$</button><button onclick={() => applyFormat('percent', `${selectedRaw}%`)}>%</button><button onclick={() => applyFormat('double', `=${selectedRaw || '0'}*2`)}>.0←</button>
    <span class="toolbar-divider"></span><button class="tiny-action" onclick={() => (track('office_format', { editor: 'sheet', action: 'remove_borders', cell: selected }), onDialog({ title: 'Cell formatting', message: 'Cell borders are hidden in this workspace.' }))}>remove more borders</button><button onclick={() => (showChart ? track('office_sheet_chart_toggled', { open: true, source: 'toolbar', already_open: true }) : toggleChart('toolbar'))}>T</button>
  </div>

  <div class="formula-bar">
    <button class="name-box" onclick={() => (track('office_sheet_name_box_clicked', { from: selected }), selectCell('A1', 'name_box'))}>{selected === 'A1' ? 'B2' : selected}</button>
    <span class="fx">𝑓<sub>x</sub></span>
    <input aria-label="Formula bar" value={selectedRaw} oninput={(event) => setCell(selected, event.currentTarget.value)} onchange={(event) => cellCommitted(selected, event.currentTarget.value, 'formula_bar')} placeholder="Enter a formula in the cell, or a cell in the formula" />
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
                <td class:selected={selected === name} onclick={() => selectCell(name, 'grid')}>
                  <input
                    aria-label={`Cell ${name}`}
                    value={showRaw ? file.cells[name] ?? '' : evaluateCell(name, file.cells)}
                    onfocus={() => selectCell(name, 'grid')}
                    oninput={(event) => setCell(name, event.currentTarget.value)}
                    onchange={(event) => cellCommitted(name, event.currentTarget.value, 'cell')}
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
        <header><strong>RECOMMENDED INTERRUPTION</strong><button onclick={() => toggleChart('panel_close')}>＋</button></header>
        <div class="chart-bars"><i style="height: 41%"></i><i style="height: 77%"></i><i style="height: 29%"></i><i style="height: 88%"></i><i style="height: 55%"></i></div>
        <p>Chart of cells we did not inspect</p><small>Confidence / sandwiches / fiscal feelings</small>
      </aside>
    {/if}
  </div>

  <div class="sheet-tabs"><button class="active">Sheet 1</button><span></span></div>
  <footer class="editor-status"><span>{Object.keys(file.cells).length ? `SUM: ${evaluateCell('E6', file.cells) || '—'}` : 'READY'}</span><span>SELECTED: {selected}</span><span class="status-grow"></span><span>100%</span><input aria-label="Zoom" type="range" min="50" max="150" value="100" onchange={(event) => track('office_sheet_zoom_dragged', { value: Number(event.currentTarget.value), applied: false })} /></footer>
</section>
