<script lang="ts">
  import { onMount } from 'svelte';
  import { mergeWorkspaces, type CloudWorkspace } from '$lib/cloud';
  import AppDialog from '$lib/components/AppDialog.svelte';
  import Docs from '$lib/components/Docs.svelte';
  import Home from '$lib/components/Home.svelte';
  import Sheets from '$lib/components/Sheets.svelte';
  import Slides from '$lib/components/Slides.svelte';
  import type { DialogRequest } from '$lib/dialog';
  import { southbagFilename } from '$lib/file-format';
  import { createFile, initialWorkspace, newOfficeFileId, type Kind, type OfficeFile, type Workspace } from '$lib/workspace';
  import type { PageData } from './$types';

  export let data: PageData;

  let workspace: Workspace = structuredClone(initialWorkspace);
  let activeId: string | null = null;
  let query = '';
  let loaded = false;
  let opening = true;
  let operationLoading = '';
  let notice = '';
  let showAccount = false;
  let syncStatus: 'loading' | 'saving' | 'saved' | 'offline' | 'error' = 'loading';
  let syncRevision = 0;
  let syncUpdatedAt = '';
  let saveTimer: number | undefined;
  let pendingWorkspace: Workspace | null = null;
  let saveInFlight = false;
  let dialogRequest: DialogRequest | null = null;

  $: activeFile = workspace.files.find((file) => file.id === activeId) ?? null;

  function storageKey(name: string) {
    return `southbag-office-v2-${data.user?.sub ?? 'blocked'}-${name}`;
  }

  onMount(() => {
    const saved = localStorage.getItem(storageKey('workspace-v1'));
    if (saved) {
      try {
        workspace = JSON.parse(saved) as Workspace;
      } catch {
        notice = 'The local workspace could not be opened.';
      }
    }
    syncRevision = Number(localStorage.getItem(storageKey('revision')) ?? '0') || 0;
    syncUpdatedAt = localStorage.getItem(storageKey('updated-at')) ?? '';
    loaded = true;
    const params = new URLSearchParams(location.search);
    if (params.get('auth') === 'unconfigured') notice = 'SSO exists but this deployment forgot its client credentials.';
    if (params.has('signed-in')) notice = 'Signed in. Cloud storage connected.';

    void openWorkspace(localStorage.getItem(storageKey('dirty')) === 'true');
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

  const delay = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

  async function openWorkspace(localDirty: boolean) {
    await Promise.all([initialiseCloud(localDirty), delay(750)]);
    opening = false;
  }

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
    persist({ ...workspace, files: workspace.files.map((file) => (file.id === nextFile.id ? nextFile : file)) });
  }

  async function encryptedFile(file: OfficeFile): Promise<{ blob: Blob; filename: string }> {
    const response = await fetch('/api/files/export', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ file })
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || 'Export failed.');
    }
    return { blob: await response.blob(), filename: southbagFilename(file.title, file.kind) };
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }

  async function exportFile(file: OfficeFile) {
    operationLoading = 'Preparing export…';
    try {
      const exported = await encryptedFile(file);
      downloadBlob(exported.blob, exported.filename);
      notice = `${exported.filename} was exported.`;
    } catch (error) {
      notice = error instanceof Error ? error.message : 'Export failed.';
    } finally {
      operationLoading = '';
    }
  }

  async function importFile(packageFile: File) {
    operationLoading = 'Opening file…';
    try {
      const response = await fetch('/api/files/import', {
        method: 'POST',
        headers: { 'content-type': packageFile.type || 'application/octet-stream' },
        body: packageFile
      });
      const body = (await response.json().catch(() => ({}))) as { file?: OfficeFile; error?: string };
      if (!response.ok || !body.file) throw new Error(body.error || 'Import failed.');
      const imported: OfficeFile = {
        ...body.file,
        id: newOfficeFileId(body.file.kind),
        owner: data.user?.name ?? 'You',
        modified: new Date().toISOString()
      };
      persist({ ...workspace, files: [imported, ...workspace.files] });
      activeId = imported.id;
      notice = `${packageFile.name} was imported.`;
    } catch (error) {
      notice = error instanceof Error ? error.message : 'Import failed.';
    } finally {
      operationLoading = '';
    }
  }

  async function create(kind: Kind) {
    operationLoading = kind === 'doc' ? 'Opening document…' : kind === 'slides' ? 'Opening presentation…' : 'Opening spreadsheet…';
    await delay(420);
    const next = createFile(kind, data.user?.name ?? 'You');
    persist({ ...workspace, files: [next, ...workspace.files] });
    activeId = next.id;
    operationLoading = '';
  }

  async function deleteFile(file: OfficeFile) {
    persist({
      ...workspace,
      files: workspace.files.filter((item) => item.id !== file.id),
      deletedIds: [...new Set([...(workspace.deletedIds ?? []), file.id])]
    });
    operationLoading = 'Deleting file…';
    await delay(360);
    operationLoading = '';
  }

  async function deleteAllFiles() {
    if (!workspace.files.length) return;
    persist({
      ...workspace,
      files: [],
      deletedIds: [...new Set([...(workspace.deletedIds ?? []), ...workspace.files.map((file) => file.id)])]
    });
    operationLoading = 'Deleting all files…';
    await delay(360);
    operationLoading = '';
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

  function closeDialog(confirmed: boolean) {
    const request = dialogRequest;
    dialogRequest = null;
    if (confirmed) request?.onConfirm?.();
  }
</script>

<svelte:head>
  <title>{activeFile ? `${activeFile.title} — Southbag Office™` : 'Southbag Office™ — Work made possible'}</title>
  <meta name="description" content="Southbag Office brings documents, presentations, and spreadsheets together, against their wishes." />
</svelte:head>

<div class="office-app" class:in-editor={Boolean(activeFile)} data-ready={loaded && !opening}>
  {#if dialogRequest}
    <AppDialog request={dialogRequest} onClose={closeDialog} />
  {/if}
  {#if opening || operationLoading}
    <div class="product-loader" role="status">
      <img src="/southbag-logo.png" alt="" />
      <p>{operationLoading || 'Opening workspace…'}</p>
      <small>{opening ? 'Synchronizing files' : 'Updating cloud storage'}</small>
    </div>
  {/if}
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
        <img src="/southbag-logo.png" alt="Southbag" /><span><strong>Office™</strong><small>WORK PRODUCT / PROBABLY</small></span>
      </button>
      <div class="global-search">
        <span>⌕</span><input bind:value={query} aria-label="Search files" placeholder="Search files" /><kbd>⌘?</kbd>
      </div>
      <button class="waffle" onclick={() => (dialogRequest = { title: 'Southbag Office', message: 'Docs, Slides, and Sheets are available from the left side.' })}>⠿</button>
      {#if data.user}
        <button class="account-button" onclick={() => (showAccount = !showAccount)}><span>{data.user.name.slice(0, 1).toUpperCase()}</span><small>{data.user.name}</small></button>
      {:else}
        <a class="identity-button" href="/auth/login" data-sveltekit-reload><span class="identity-dot">S</span> Sign in after entering</a>
      {/if}
      {#if showAccount && data.user}
        <div class="account-popover"><strong>{data.user.name}</strong><span>{data.user.email}</span><p>Authenticated by Southbag Identity™</p><a href="/auth/logout" data-sveltekit-reload>Stay signed in (sign out)</a></div>
      {/if}
    </header>
  {/if}

  {#if notice}
    <div class="notice">{notice}<button onclick={() => (notice = '')}>×</button></div>
  {/if}

  {#if activeFile}
    {#if activeFile.kind === 'doc'}
      <Docs file={activeFile} onChange={updateFile} onExit={() => (activeId = null)} onDialog={(request) => (dialogRequest = request)} onExport={exportFile} />
    {:else if activeFile.kind === 'slides'}
      <Slides file={activeFile} onChange={updateFile} onExit={() => (activeId = null)} onDialog={(request) => (dialogRequest = request)} onExport={exportFile} />
    {:else}
      <Sheets file={activeFile} onChange={updateFile} onExit={() => (activeId = null)} onDialog={(request) => (dialogRequest = request)} onExport={exportFile} />
    {/if}
  {:else}
    <div class="shell-grid">
      <aside class="app-sidebar">
        <button class="nav-home active" onclick={() => navigate('home')}><span>⌂</span><strong>Files</strong></button>
        <div class="app-nav">
          <button class="doc-nav" onclick={() => navigate('doc')}><span>¶</span><strong>Docs</strong><small>Write</small></button>
          <button class="slides-nav" onclick={() => navigate('slides')}><span>▰</span><strong>Slides</strong><small>Present</small></button>
          <button class="sheet-nav" onclick={() => navigate('sheet')}><span>⌗</span><strong>Sheets</strong><small>Calculate</small></button>
        </div>
        <div class="sidebar-spacer"></div>
        <button class="storage" onclick={() => (dialogRequest = { title: 'Cloud storage', message: syncStatus === 'saved' ? 'Your files are saved in D1 and cached in this browser.' : 'Your files are cached in this browser and waiting for the cloud.' })}>
          <span class="storage-ring"><i></i></span>
          <span><strong>Cloud storage</strong><small>{syncStatus}</small></span>
        </button>
        <button class="help-link" onclick={() => (dialogRequest = { title: 'Support', message: 'Create a file, open it, and begin typing. Changes save automatically.' })}>Support</button>
      </aside>

      <main class="main-content">
        <Home files={workspace.files} {query} onOpen={(file) => (activeId = file.id)} onCreate={create} onDelete={deleteFile} onDeleteAll={deleteAllFiles} onExport={exportFile} onImport={importFile} onDialog={(request) => (dialogRequest = request)} />
      </main>
    </div>
  {/if}
</div>
