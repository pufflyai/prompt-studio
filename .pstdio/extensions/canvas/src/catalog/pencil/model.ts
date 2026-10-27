export type DesignTheme = Record<string, string>;
export type DesignScalar = string | number | boolean;
export interface DesignPaint {
  type: string;
  enabled?: boolean;
  color?: string;
  url?: string;
  mode?: string;
  opacity?: number;
  rotation?: number;
  gradientType?: string;
  colors?: { color: string; position: number }[];
}
export interface DesignEffect {
  type: string;
  enabled?: boolean;
  shadowType?: string;
  color?: string;
  offset?: { x: number; y: number };
  blur?: number;
  spread?: number;
  radius?: number;
}
export interface DesignNode extends Record<string, unknown> {
  id: string;
  type: string;
  name?: string;
  ref?: string;
  theme?: DesignTheme;
  children?: DesignNode[];
  descendants?: Record<string, Partial<DesignNode>>;
  width?: number | string;
  height?: number | string;
  x?: number;
  y?: number;
  fill?: string | DesignPaint | DesignPaint[];
  content?: string;
}
export interface DesignDocument {
  children: DesignNode[];
  themes: Record<string, string[]>;
  variables: Record<string, { type: string; value: DesignScalar | { value: DesignScalar; theme?: DesignTheme }[] }>;
  assets?: Record<string, string>;
  fonts?: string;
}

export const defaultDesignTheme = (document: DesignDocument) =>
  Object.fromEntries(Object.entries(document.themes).map(([name, values]) => [name, values[0]]));

export const resolveDesignValue = (document: DesignDocument, value: unknown, theme: DesignTheme) => {
  const seen = new Set<string>();
  let current = value;
  while (typeof current === "string" && current.startsWith("$")) {
    const name = current.slice(1);
    if (seen.has(name)) throw new Error(`Cyclic design variable ${name}`);
    seen.add(name);
    const variable = document.variables[name];
    if (!variable) throw new Error(`Missing design variable ${name}`);
    if (!Array.isArray(variable.value)) {
      current = variable.value;
      continue;
    }
    let specificity = -1;
    for (const option of variable.value) {
      const axes = Object.entries(option.theme ?? {});
      if (axes.length >= specificity && axes.every(([axis, selection]) => theme[axis] === selection)) {
        current = option.value;
        specificity = axes.length;
      }
    }
    if (specificity < 0) current = variable.value[0]?.value;
  }
  return current;
};

const mergeNode = (base: DesignNode, patch: Partial<DesignNode>): DesignNode => ({
  ...base,
  ...patch,
  theme: { ...base.theme, ...patch.theme },
  descendants: { ...base.descendants, ...patch.descendants },
});
const expanded = new WeakMap<DesignDocument, Map<string, DesignNode>>();
export const expandDesign = (document: DesignDocument, rootId: string) => {
  let cache = expanded.get(document);
  if (!cache) {
    cache = new Map();
    expanded.set(document, cache);
  }
  const existing = cache.get(rootId);
  if (existing) return existing;
  const index = new Map<string, DesignNode>();
  const collect = (nodes: DesignNode[]) => {
    for (const node of nodes) {
      index.set(node.id, node);
      collect(node.children ?? []);
    }
  };
  collect(document.children);
  const expand = (
    source: DesignNode,
    patches: Record<string, Partial<DesignNode>>,
    ancestors: Set<string>,
  ): DesignNode => {
    let node = mergeNode(source, patches[""] ?? {});
    const references = new Set(ancestors);
    let overrides = { ...node.descendants, ...patches };
    while (node.type === "ref") {
      const target = node.ref!;
      if (references.has(target)) throw new Error(`Cyclic design component ${target}`);
      references.add(target);
      const base = index.get(target);
      if (!base) throw new Error(`Missing design component ${target}`);
      const { type: _type, ref: _ref, ...instance } = node;
      node = mergeNode(base, instance);
      overrides = { ...node.descendants, ...overrides };
    }
    const children = node.children?.map((child) => {
      const prefix = `${child.id}/`;
      // Bare IDs address descendants through normal groups. A component instance
      // starts a new scope; only its prefixed overrides cross that boundary.
      const scoped: Record<string, Partial<DesignNode>> = child.type === "ref" ? {} : { ...overrides };
      delete scoped[""];
      for (const [path, patch] of Object.entries(overrides)) {
        if (path === child.id) scoped[""] = patch;
        else if (path.startsWith(prefix)) scoped[path.slice(prefix.length)] = patch;
      }
      return expand(child, scoped, references);
    });
    return { ...node, children };
  };
  const root = index.get(rootId);
  if (!root) throw new Error(`Missing design ${rootId}`);
  const result = expand(root, {}, new Set());
  cache.set(rootId, result);
  return result;
};
