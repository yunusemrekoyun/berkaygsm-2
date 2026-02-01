export function flattenCategoryTree(tree = [], depth = 0, ancestry = []) {
  const result = [];
  tree.forEach((node) => {
    const chain = [...ancestry, node];
    result.push({
      id: node.id,
      name: node.name,
      slug: node.slug,
      level: depth,
      label: node.name,
      path: chain.map((c) => c.name),
      node,
    });
    if (node.children?.length) {
      result.push(...flattenCategoryTree(node.children, depth + 1, chain));
    }
  });
  return result;
}

export function collectDescendantIds(tree = [], targetId) {
  const stack = [...tree];
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    if (String(current.id) === String(targetId)) {
      const descendants = [];
      collect(current, descendants);
      return descendants.map((item) => item.id || item);
    }
    if (current.children?.length) stack.push(...current.children);
  }
  return [];
}

function collect(node, acc) {
  if (!node?.children) return;
  node.children.forEach((child) => {
    acc.push(child);
    collect(child, acc);
  });
}

export function mapCategoryTree(tree = [], depth = 0) {
  return tree.map((node) => ({
    id: node.id,
    name: node.name,
    slug: node.slug,
    level: depth,
     image: node.image?.url || node.image || null,
    children: node.children ? mapCategoryTree(node.children, depth + 1) : [],
  }));
}
