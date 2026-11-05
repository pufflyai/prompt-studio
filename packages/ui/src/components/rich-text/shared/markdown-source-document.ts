import { $getRoot, type ElementNode } from "lexical";
import { exportLexicalToMarkdown } from "./markdown-export";
import { importMarkdownToLexical } from "./markdown-import";
import { applyMarkdownSourceChanges } from "./markdown-source-edits";
import { buildSourceMap, type SourceMap } from "./markdown-source-map";
import { createMarkdownSourceParser } from "./markdown-source-parser";
import { reconcileMarkdownSource } from "./markdown-source-reconcile";
import type { MarkdownTableProjection } from "./markdown-source-tables";
import type { MarkdownUrlResolver } from "./markdown-url";

export interface MarkdownSourceDocument {
  exportFromLexical: (root: ElementNode) => string;
  importToLexical: () => void;
  reconcileFromSource: (source: string, projection?: MarkdownTableProjection) => void;
}

export const createMarkdownSourceDocument = (
  source: string,
  resolver?: MarkdownUrlResolver,
): MarkdownSourceDocument => {
  let baseline: string | null = null;
  let sourceMap: SourceMap | null = null;
  let parse = createMarkdownSourceParser([source]);

  return {
    importToLexical() {
      importMarkdownToLexical(source, resolver);
      baseline = exportLexicalToMarkdown($getRoot());
      parse = createMarkdownSourceParser([baseline, source]);
      sourceMap = buildSourceMap(baseline, source, parse);
    },
    reconcileFromSource(nextSource, projection) {
      reconcileMarkdownSource(nextSource, resolver, projection);
      source = nextSource;
      baseline = exportLexicalToMarkdown($getRoot());
      parse = createMarkdownSourceParser([baseline, source]);
      sourceMap = buildSourceMap(baseline, source, parse);
    },
    exportFromLexical(root) {
      const current = exportLexicalToMarkdown(root);
      const loadedBaseline = baseline ?? current;
      return applyMarkdownSourceChanges(
        source,
        loadedBaseline,
        current,
        sourceMap ?? buildSourceMap(loadedBaseline, source, parse),
        parse,
      );
    },
  };
};
