import Prism from "prismjs";

const globalScope = globalThis as typeof globalThis & { Prism?: unknown };

globalScope.Prism ??= Prism;

export { Prism };
