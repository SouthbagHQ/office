export function normalizeKevin(value: string) {
  return value.replace(/kevin/gi, 'Kevin');
}

export function normalizeKevinText(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) node.nodeValue = normalizeKevin(node.nodeValue ?? '');
}
