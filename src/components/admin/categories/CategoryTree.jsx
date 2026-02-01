import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FolderTree,
  Image as ImageIcon,
  PlusCircle,
} from "lucide-react";

export default function CategoryTree({
  items = [],
  selectedId,
  onSelect,
  onCreateRoot,
}) {
  const [expanded, setExpanded] = useState(() => new Set());

  useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev);
      items.forEach((item) => next.add(item.id));
      return next;
    });
  }, [items]);

  useEffect(() => {
    if (!selectedId) return;
    const path = findPath(items, selectedId);
    if (!path.length) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      path.forEach((node) => next.add(node.id));
      return next;
    });
  }, [items, selectedId]);

  const totalCount = useMemo(() => countNodes(items), [items]);

  const toggle = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] shadow-sm">
      <div className="flex items-center justify-between border-b border-[var(--color-border-admin)] px-4 py-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-admin)]">
            Kategori Ağacı
          </h3>
          <p className="text-xs text-[var(--color-text-admin-muted)]">
            {totalCount} {totalCount === 1 ? "kayıt" : "kayıt"}
          </p>
        </div>
        <button
          onClick={onCreateRoot}
          className="inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-hover)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)]/70"
        >
          <PlusCircle className="h-4 w-4" />
          Yeni kök
        </button>
      </div>

      {items.length === 0 ? (
        <EmptyState onCreateRoot={onCreateRoot} />
      ) : (
        <ul className="space-y-1 px-2 py-3">
          {items.map((item) => (
            <TreeNode
              key={item.id}
              node={item}
              depth={0}
              expanded={expanded}
              onToggle={toggle}
              onSelect={onSelect}
              selectedId={selectedId}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function TreeNode({ node, depth, expanded, onToggle, selectedId, onSelect }) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  const isSelected = selectedId === node.id;

  const handleToggle = () => {
    if (hasChildren) onToggle(node.id);
  };

  return (
    <li>
      <div
        className={`flex items-center gap-2 rounded-xl px-2 py-1 transition ${
          isSelected
            ? "bg-[var(--color-bg-hover)] text-[var(--color-text-admin)]"
            : "text-[var(--color-text-admin)]/80 hover:bg-[var(--color-bg-hover)]/70"
        }`}
        style={{ paddingLeft: 12 + depth * 14 }}
      >
        <button
          type="button"
          onClick={handleToggle}
          className={`grid h-6 w-6 place-items-center rounded-full border border-[var(--color-border-admin)] text-[var(--color-text-admin-muted)] transition ${
            hasChildren
              ? "hover:border-[var(--color-text-admin)]"
              : "pointer-events-none opacity-0"
          }`}
          aria-label={isExpanded ? "Daralt" : "Genişlet"}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )
          ) : (
            <FolderTree className="h-4 w-4" />
          )}
        </button>
        <button
          type="button"
          onClick={() => onSelect?.(node)}
          className="flex flex-1 items-center justify-between gap-2 text-left"
        >
          <span className="flex flex-1 items-center gap-2 truncate text-sm">
            <span className="truncate font-medium">{node.name}</span>
            {node.image?.url && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border-admin)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--color-text-admin-muted)]">
                <ImageIcon className="h-3 w-3" />
                görsel
              </span>
            )}
          </span>
          {hasChildren && (
            <span className="text-xs text-[var(--color-text-admin-muted)]">
              {node.children.length}
            </span>
          )}
        </button>
      </div>
      {hasChildren && isExpanded && (
        <ul className="space-y-1">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
              selectedId={selectedId}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function EmptyState({ onCreateRoot }) {
  return (
    <div className="grid place-items-center gap-3 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-bg-hover)] text-[var(--color-text-admin)]">
        <FolderTree className="h-6 w-6" />
      </div>
      <p className="text-sm text-[var(--color-text-admin-muted)]">
        Henüz kategori yok. Başlamak için ilk kök kategorinizi oluşturun.
      </p>
      <button
        onClick={onCreateRoot}
        className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)]"
      >
        <PlusCircle className="h-4 w-4" />
        Kök kategori ekle
      </button>
    </div>
  );
}

function countNodes(nodes) {
  return nodes.reduce((acc, node) => {
    const childrenCount = node.children ? countNodes(node.children) : 0;
    return acc + 1 + childrenCount;
  }, 0);
}

function findPath(tree, targetId) {
  const stack = tree.map((node) => ({ node, path: [node] }));
  while (stack.length) {
    const { node, path } = stack.pop();
    if (String(node.id) === String(targetId)) {
      return path;
    }
    if (node.children?.length) {
      node.children.forEach((child) => {
        stack.push({ node: child, path: [...path, child] });
      });
    }
  }
  return [];
}
