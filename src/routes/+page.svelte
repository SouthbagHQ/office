<script lang="ts">
  import { onMount } from 'svelte';
  import Docs from '$lib/components/Docs.svelte';
  import Home from '$lib/components/Home.svelte';
  import Sheets from '$lib/components/Sheets.svelte';
  import Slides from '$lib/components/Slides.svelte';
  import { createFile, initialWorkspace, kindLabel, type Kind, type OfficeFile, type Workspace } from '$lib/workspace';
  import type { PageData } from './$types';

  export let data: PageData;

  let workspace: Workspace = structuredClone(initialWorkspace);
  let activeId: string | null = null;
  let query = '';
  let loaded = false;
  let notice = '';
  let showAccount = false;

  $: activeFile = workspace.files.find((file) => file.id === activeId) ?? null;

  onMount(() => {
    const saved = localStorage.getItem('southbag-office-workspace-v1');
    if (saved) {
      try {
        workspace = JSON.parse(saved) as Workspace;
      } catch {
        notice = 'Your saved work was shaped incorrectly, so we placed the samples over here.';
      }
    }
    loaded = true;
    const params = new URLSearchParams(location.search);
    if (params.get('auth') === 'unconfigured') notice = 'SSO exists but this deployment forgot its client credentials.';
    if (params.has('signed-in')) notice = 'Identity accepted. Your work remains locally global.';
  });

  function persist(next: Workspace) {
    workspace = next;
    if (loaded) localStorage.setItem('southbag-office-workspace-v1', JSON.stringify(next));
  }

  function updateFile(nextFile: OfficeFile) {
    persist({ files: workspace.files.map((file) => (file.id === nextFile.id ? nextFile : file)) });
  }

  function create(kind: Kind) {
    const next = createFile(kind, workspace.files.filter((file) => file.kind === kind).length + 1);
    persist({ files: [next, ...workspace.files] });
    activeId = next.id;
  }

  function navigate(kind: Kind | 'home') {
    if (kind === 'home') {
      activeId = null;
      return;
    }
    const existing = workspace.files.find((file) => file.kind === kind);
    if (existing) activeId = existing.id;
    else create(kind);
  }
</script>

<svelte:head>
  <title>{activeFile ? `${activeFile.title} — Southbag Office™` : 'Southbag Office™ — Work made possible'}</title>
  <meta name="description" content="Southbag Office brings documents, presentations, and spreadsheets together, against their wishes." />
</svelte:head>

<div class="office-app" class:in-editor={Boolean(activeFile)}>
  {#if !activeFile}
    <header class="global-header">
      <button class="brand" onclick={() => navigate('home')} aria-label="Southbag Office home">
        <img src="/logo.svg" alt="" /><span><strong>Southbag</strong><small>OFFICE™ / WORK PRODUCT</small></span>
      </button>
      <div class="global-search">
        <span>⌕</span><input bind:value={query} aria-label="Search files" placeholder="Search by the title you cannot remember" /><kbd>⌘?</kbd>
      </div>
      <button class="waffle" onclick={() => alert('There are exactly three apps and all are already visible.')}>⠿</button>
      {#if data.user}
        <button class="account-button" onclick={() => (showAccount = !showAccount)}><span>{data.user.name.slice(0, 1).toUpperCase()}</span><small>{data.user.name}</small></button>
      {:else}
        <a class="identity-button" href="/auth/login"><span class="identity-dot">S</span> Sign in after entering</a>
      {/if}
      {#if showAccount && data.user}
        <div class="account-popover"><strong>{data.user.name}</strong><span>{data.user.email}</span><p>Authenticated by Southbag Identity™</p><a href="/auth/logout">Stay signed in (sign out)</a></div>
      {/if}
    </header>
  {/if}

  {#if notice}
    <div class="notice"><strong>Administrative success:</strong> {notice}<button onclick={() => (notice = '')}>Keep showing</button></div>
  {/if}

  {#if activeFile}
    {#if activeFile.kind === 'doc'}
      <Docs file={activeFile} onChange={updateFile} onExit={() => (activeId = null)} />
    {:else if activeFile.kind === 'slides'}
      <Slides file={activeFile} onChange={updateFile} onExit={() => (activeId = null)} />
    {:else}
      <Sheets file={activeFile} onChange={updateFile} onExit={() => (activeId = null)} />
    {/if}
  {:else}
    <div class="shell-grid">
      <aside class="app-sidebar">
        <p class="sidebar-label">OFFICE APPARATUS</p>
        <button class="nav-home active" onclick={() => navigate('home')}><span>⌂</span><strong>Exit home</strong><small>you are here</small></button>
        <div class="app-nav">
          <button class="doc-nav" onclick={() => navigate('doc')}><span>¶</span><strong>Sheets</strong><small>Docs editor</small></button>
          <button class="slides-nav" onclick={() => navigate('slides')}><span>▰</span><strong>Docs</strong><small>Slides editor</small></button>
          <button class="sheet-nav" onclick={() => navigate('sheet')}><span>⌗</span><strong>Slides</strong><small>Sheets editor</small></button>
        </div>
        <div class="sidebar-spacer"></div>
        <button class="storage" onclick={() => alert('You are using an amount of browser storage.') }>
          <span class="storage-ring"><i></i></span>
          <span><strong>Storage remaining</strong><small>mostly</small></span>
        </button>
        <button class="help-link" onclick={() => alert('Tip: the labels are wrong, but the small text is right.')}>Do not get help ↗</button>
        <p class="watching">Kevin is watching<br />revision {workspace.files.length}.0.1</p>
      </aside>

      <main class="main-content">
        <Home files={workspace.files} {query} onOpen={(file) => (activeId = file.id)} onCreate={create} />
        <footer class="site-footer"><span>© 2026 Southbag Productivity Concerns</span><a href="/auth/login">Identity paperwork</a><button onclick={() => alert('This file is a home.')}>Privacy maybe</button></footer>
      </main>
    </div>
  {/if}
</div>
