<script lang="ts">
  import { onMount } from 'svelte';
  import { mergeWorkspaces, type CloudWorkspace } from '$lib/cloud';
  import Docs from '$lib/components/Docs.svelte';
  import Home from '$lib/components/Home.svelte';
  import Sheets from '$lib/components/Sheets.svelte';
  import Slides from '$lib/components/Slides.svelte';
  import { createFile, initialWorkspace, type Kind, type OfficeFile, type Workspace } from '$lib/workspace';
  import type { PageData } from './$types';

  export let data: PageData;

  let workspace: Workspace = structuredClone(initialWorkspace);
  let activeId: string | null = null;
  let query = '';
  let loaded = false;
  let notice = '';
  let showAccount = false;
  let syncStatus: 'loading' | 'saving' | 'saved' | 'offline' | 'error' = 'loading';
  let syncRevision = 0;
  let syncUpdatedAt = '';
  let saveTimer: number | undefined;
  let pendingWorkspace: Workspace | null = null;
  let saveInFlight = false;

  $: activeFile = workspace.files.find((file) => file.id === activeId) ?? null;

  function storageKey(name: string) {
    return `southbag-office-${data.user?.sub ?? 'blocked'}-${name}`;
  }

  onMount(() => {
    const saved = localStorage.getItem(storageKey('workspace-v1'));
    if (saved) {
      try {
        workspace = JSON.parse(saved) as Workspace;
      } catch {
        notice = 'Your saved work was shaped incorrectly, so we placed the samples over here.';
      }
    }
    syncRevision = Number(localStorage.getItem(storageKey('revision')) ?? '0') || 0;
    syncUpdatedAt = localStorage.getItem(storageKey('updated-at')) ?? '';
    loaded = true;
    const params = new URLSearchParams(location.search);
    if (params.get('auth') === 'unconfigured') notice = 'SSO exists but this deployment forgot its client credentials.';
    if (params.has('signed-in')) notice = 'Identity accepted. Your cloud filing cabinet is now attached.';

    void initialiseCloud(localStorage.getItem(storageKey('dirty')) === 'true');
    const flushBeforeLeaving = () => {
      if (pendingWorkspace) void flushCloud();
    };
    window.addEventListener('pagehide', flushBeforeLeaving);
    window.addEventListener('online', flushBeforeLeaving);
    return () => {
      window.removeEventListener('pagehide', flushBeforeLeaving);
      window.removeEventListener('online', flushBeforeLeaving);
      if (saveTimer) window.clearTimeout(saveTimer);
    };
  });

  async function initialiseCloud(localDirty: boolean) {
    syncStatus = 'loading';
    if (localDirty) {
      pendingWorkspace = workspace;
      await flushCloud();
      return;
    }
    try {
      const response = await fetch('/api/workspace');
      if (!response.ok) throw new Error('cloud load failed');
      const cloud = (await response.json()) as Omit<CloudWorkspace, 'workspace'> & { workspace: Workspace | null };
      if (!cloud.workspace) {
        pendingWorkspace = workspace;
        await flushCloud();
        return;
      }
      workspace = cloud.workspace;
      syncRevision = cloud.revision;
      syncUpdatedAt = cloud.updatedAt;
      localStorage.setItem(storageKey('workspace-v1'), JSON.stringify(workspace));
      localStorage.setItem(storageKey('revision'), String(syncRevision));
      localStorage.setItem(storageKey('updated-at'), syncUpdatedAt);
      localStorage.setItem(storageKey('dirty'), 'false');
      syncStatus = 'saved';
    } catch {
      syncStatus = navigator.onLine ? 'error' : 'offline';
    }
  }

  function queueCloudSave(next: Workspace) {
    pendingWorkspace = next;
    syncStatus = navigator.onLine ? 'saving' : 'offline';
    if (saveTimer) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => void flushCloud(), 700);
  }

  async function flushCloud() {
    if (saveInFlight || !pendingWorkspace) return;
    const sending = pendingWorkspace;
    pendingWorkspace = null;
    saveInFlight = true;
    syncStatus = 'saving';
    try {
      let response = await fetch('/api/workspace', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workspace: sending, expectedRevision: syncRevision }),
        keepalive: true
      });
      let cloud = (await response.json().catch(() => ({}))) as Partial<CloudWorkspace>;
      if (response.status === 409 && cloud.workspace && typeof cloud.revision === 'number') {
        const merged = mergeWorkspaces(sending, cloud.workspace);
        workspace = merged;
        localStorage.setItem(storageKey('workspace-v1'), JSON.stringify(merged));
        syncRevision = cloud.revision;
        response = await fetch('/api/workspace', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ workspace: merged, expectedRevision: syncRevision }),
          keepalive: true
        });
        cloud = (await response.json().catch(() => ({}))) as Partial<CloudWorkspace>;
      }
      if (!response.ok || typeof cloud.revision !== 'number') throw new Error('cloud save failed');
      syncRevision = cloud.revision;
      syncUpdatedAt = cloud.updatedAt ?? new Date().toISOString();
      localStorage.setItem(storageKey('revision'), String(syncRevision));
      localStorage.setItem(storageKey('updated-at'), syncUpdatedAt);
      localStorage.setItem(storageKey('dirty'), 'false');
      syncStatus = 'saved';
    } catch {
      pendingWorkspace = workspace;
      syncStatus = navigator.onLine ? 'error' : 'offline';
    } finally {
      saveInFlight = false;
      if (pendingWorkspace && syncStatus !== 'error' && syncStatus !== 'offline') queueCloudSave(pendingWorkspace);
    }
  }

  function persist(next: Workspace) {
    workspace = next;
    if (loaded) {
      localStorage.setItem(storageKey('workspace-v1'), JSON.stringify(next));
      localStorage.setItem(storageKey('dirty'), 'true');
      queueCloudSave(next);
    }
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

<div class="office-app" class:in-editor={Boolean(activeFile)} data-ready={loaded}>
  <button
    class="cloud-status cloud-{syncStatus}"
    title={syncUpdatedAt ? `Last cloud save ${new Date(syncUpdatedAt).toLocaleString()}` : 'Cloud save status'}
    onclick={() => (pendingWorkspace = workspace, void flushCloud())}
  >
    <i></i><strong>{syncStatus === 'saved' ? 'Saved to cloud' : syncStatus === 'saving' ? 'Saving to cloud…' : syncStatus === 'loading' ? 'Opening cloud…' : syncStatus === 'offline' ? 'Offline — saved here' : 'Cloud needs retry'}</strong>
    <span>Southbag Identity workspace</span>
  </button>
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
          <button class="doc-nav" onclick={() => navigate('doc')}><span>¶</span><strong>Docs</strong><small>write something official-ish</small></button>
          <button class="slides-nav" onclick={() => navigate('slides')}><span>▰</span><strong>Slides</strong><small>present something sideways</small></button>
          <button class="sheet-nav" onclick={() => navigate('sheet')}><span>⌗</span><strong>Sheets</strong><small>calculate with feelings</small></button>
        </div>
        <div class="sidebar-spacer"></div>
        <button class="storage" onclick={() => alert(syncStatus === 'saved' ? 'Your files are saved in D1 cloud storage and cached in this browser.' : 'Your files are cached in this browser and waiting for the cloud.') }>
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
