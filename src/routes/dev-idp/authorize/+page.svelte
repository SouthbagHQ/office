<script lang="ts">
  import type { ActionData, PageData } from './$types';
  export let data: PageData;
  export let form: ActionData;
</script>

<svelte:head><title>Southbag Development Identity</title></svelte:head>

<main class="dev-idp-page">
  <header><img src="/southbag-logo.png" alt="Southbag" /><div><h1>Development Identity™</h1><p>Temporary OAuth Provider / Definitely not production</p></div></header>
  <form method="post">
    <input type="hidden" name="oauthQuery" value={data.oauthQuery} />
    <strong>Sign in to test Southbag Office</strong>
    <label>Work email<input name="email" type="email" value={form?.email ?? ''} autocomplete="username" required /></label>
    <label>Name<input name="name" value={form?.name ?? ''} autocomplete="name" required /></label>
    <label>Password<input name="password" type="password" autocomplete="current-password" required /></label>
    {#if form?.message}<p class="idp-error">{form.message}</p>{/if}
    <button>Authorise Office</button>
    <small>Development credential: employee@southbag.cc / southbag</small>
  </form>
</main>

<style>
  :global(body) { margin:0;background:#fff;font-family:"Times New Roman",serif; }
  :global(*) { box-shadow:0 0 10px rgba(0,0,0,.45),inset 0 0 5px rgba(255,255,255,.3);text-shadow:1px 1px 2px rgba(0,0,0,.35);border:0; }
  .dev-idp-page { max-width:850px;margin:0 auto;padding:35px; }
  header { display:flex;flex-wrap:wrap;align-items:center;gap:18px;margin-bottom:35px; }
  header img { width:min(330px,100%);height:94px;object-fit:fill;transform:rotate(-2deg); }
  h1 { margin:0;font-size:clamp(42px,8vw,86px);line-height:.85; }
  header p { font:10px monospace;letter-spacing:2px; }
  form { display:grid;gap:22px;padding:28px;background:#eee;transform:skew(-1deg); }
  form strong { font-size:24px; }
  label { display:grid;gap:6px;transform:skew(4deg); }
  input { padding:12px;background:#fff;font:16px "Times New Roman"; }
  button { justify-self:start;padding:15px 28px;background:#ddd;font-size:20px;cursor:pointer; }
  small { font:10px monospace; }.idp-error { background:#ff9b9b;padding:10px; }
</style>
