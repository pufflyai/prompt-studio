const DOCS_ROUTE_PREFIX = "/documentation";

export const repositoryDocUrl = (path: string) => {
  if (path === "index.md") return DOCS_ROUTE_PREFIX;
  if (path.endsWith("/index.md")) return `${DOCS_ROUTE_PREFIX}/${path.slice(0, -"/index.md".length)}`;
  return `${DOCS_ROUTE_PREFIX}/${path.replace(/\.md$/, "")}`;
};

export const resolveRepositoryDocPathFromUrl = (url: string, availablePaths: ReadonlySet<string>) => {
  const pathname = url.split(/[?#]/)[0].replace(/\/+$/, "");
  if (pathname === DOCS_ROUTE_PREFIX) return "index.md";
  if (!pathname.startsWith(`${DOCS_ROUTE_PREFIX}/`)) return undefined;

  const partialPath = pathname.slice(DOCS_ROUTE_PREFIX.length + 1);
  return [partialPath, `${partialPath}.md`, `${partialPath}/index.md`].find((path) => availablePaths.has(path));
};
