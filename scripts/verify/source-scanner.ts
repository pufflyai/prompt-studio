import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import * as ts from "typescript";

const SKIP_DIRS = new Set(["node_modules", "dist", ".cache", "__test-tmp__", "_reference", "storybook-static"]);

export interface ImportedSpecifier {
  specifier: string;
  typeOnly: boolean;
}

export const normalizePath = (file: string) => file.split(path.sep).join("/");

export const collectSourceFiles = (dir: string) => {
  const files: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith(".")) walk(path.join(current, entry.name));
        continue;
      }
      if (/\.(ts|tsx)$/.test(entry.name)) files.push(path.join(current, entry.name));
    }
  };
  if (statSync(dir, { throwIfNoEntry: false })?.isDirectory()) walk(dir);
  return files;
};

const addStringLiteral = (specifiers: ImportedSpecifier[], node: ts.Node | undefined, typeOnly: boolean) => {
  if (node && ts.isStringLiteralLike(node)) specifiers.push({ specifier: node.text, typeOnly });
};

export const collectSpecifiers = (file: string, source: string) => {
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
  const specifiers: ImportedSpecifier[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node)) {
      addStringLiteral(specifiers, node.moduleSpecifier, node.importClause?.isTypeOnly ?? false);
    }
    if (ts.isExportDeclaration(node)) {
      addStringLiteral(specifiers, node.moduleSpecifier, node.isTypeOnly);
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      addStringLiteral(specifiers, node.arguments[0], false);
    }
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      addStringLiteral(specifiers, node.argument.literal, true);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return specifiers;
};
