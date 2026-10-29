import type { FrameBootstrap } from "./assets";

export interface FrameGraph {
  entry: string;
  catalog: string;
  sources: Record<string, { script: string; project?: string }>;
  modules: Record<string, { imports: string[]; dynamicImports: string[]; styles: number[] }>;
}

export const selectFrameBootstrap = (bootstrap: FrameBootstrap, source: string): FrameBootstrap => {
  const { graph } = bootstrap;
  if (!Object.hasOwn(graph.sources, source)) throw new Error(`Missing preview source: ${source}`);
  const selected = graph.sources[source]!;
  const catalogRoots = new Set(Object.values(graph.sources).flatMap(({ script, project }) => [script, project]));
  const visited = new Set<string>();
  const styles = new Set<number>();
  const visit = (name: string) => {
    if (visited.has(name)) return;
    const module = graph.modules[name];
    if (!module || !bootstrap.scripts[name]) throw new Error(`Missing compiled preview module: ${name}`);
    visited.add(name);
    for (const style of module.styles) styles.add(style);
    for (const dependency of module.imports) visit(dependency);
    for (const dependency of module.dynamicImports)
      if (name !== graph.catalog || !catalogRoots.has(dependency)) visit(dependency);
  };
  visit(graph.entry);
  visit(selected.script);
  if (selected.project) visit(selected.project);
  return {
    ...bootstrap,
    scripts: Object.fromEntries([...visited].map((name) => [name, bootstrap.scripts[name]!])),
    styles: bootstrap.styles.filter((_style, index) => styles.has(index)),
  };
};
