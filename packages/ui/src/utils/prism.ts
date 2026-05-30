const readDefaultExport = (module: { default?: unknown }) => module.default ?? module;

export const installPrismGlobal = async () => {
  const globalScope = globalThis as typeof globalThis & { Prism?: unknown };
  if (globalScope.Prism) return;

  const prismModule = await import("prismjs");
  globalScope.Prism = readDefaultExport(prismModule);
};
