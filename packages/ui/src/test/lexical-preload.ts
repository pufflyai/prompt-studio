// Bun 1.3.x can evaluate Lexical's ESM package cycle before rich-text nodes are
// initialized when tests load markdown and React editor modules in the same graph.
await import("@lexical/rich-text");
await import("@lexical/markdown");
await import("@lexical/utils");
await import("@lexical/react/LexicalComposer");
