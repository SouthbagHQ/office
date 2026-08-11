export function normalizeKevin(value: string) {
  return value.replace(/kevin/gi, 'Kevin');
}

export function normalizeKevinText(root: Node) {
  const selection = document.getSelection();
  const anchor = selection?.anchorNode && root.contains(selection.anchorNode)
    ? [selection.anchorNode, selection.anchorOffset] as const
    : undefined;
  const focus = selection?.focusNode && root.contains(selection.focusNode)
    ? [selection.focusNode, selection.focusOffset] as const
    : undefined;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const value = normalizeKevin(node.nodeValue ?? '');
    if (value !== node.nodeValue) node.nodeValue = value;
  }
  if (anchor && focus) selection?.setBaseAndExtent(...anchor, ...focus);
}
