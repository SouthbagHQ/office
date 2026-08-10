<script lang="ts">
  export let value: string;
  export let className: string;
  export let label: string;
  export let onChange: (value: string) => void;

  const initialValue = value;
</script>

<div
  class={className}
  contenteditable="true"
  role="textbox"
  aria-label={label}
  oninput={(event) => onChange(event.currentTarget.textContent ?? '')}
>{initialValue}</div>
