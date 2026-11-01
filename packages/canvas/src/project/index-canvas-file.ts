import ts from "typescript";

// Reads a canvas file without running it, so listing never executes project code.

interface SourceIndex {
  file: ts.SourceFile;
  declarations: Map<string, ts.Expression>;
  functions: Set<string>;
}

const sentenceCase = (name: string) => {
  const words = name
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[\s_]+/)
    .filter(Boolean);
  return words.map((word, index) => (index === 0 ? word : word.toLowerCase())).join(" ");
};

const unwrap = (node: ts.Expression): ts.Expression =>
  ts.isSatisfiesExpression(node) || ts.isAsExpression(node) || ts.isParenthesizedExpression(node)
    ? unwrap(node.expression)
    : node;

const readSource = (path: string, source: string): SourceIndex => {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = new Map<string, ts.Expression>();
  const functions = new Set<string>();
  for (const statement of file.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) functions.add(statement.name.text);
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations)
      if (ts.isIdentifier(declaration.name) && declaration.initializer)
        declarations.set(declaration.name.text, declaration.initializer);
  }
  return { file, declarations, functions };
};

const resolveValue = (index: SourceIndex, node?: ts.Expression): ts.Expression | undefined => {
  if (!node) return;
  const value = unwrap(node);
  if (ts.isIdentifier(value) && index.declarations.has(value.text))
    return resolveValue(index, index.declarations.get(value.text));
  return value;
};

const property = (index: SourceIndex, node: ts.Expression | undefined, key: string) => {
  if (!node || !ts.isObjectLiteralExpression(node)) return;
  const found = node.properties.find(
    (entry): entry is ts.PropertyAssignment => ts.isPropertyAssignment(entry) && entry.name.getText(index.file) === key,
  );
  return found && unwrap(found.initializer);
};

const text = (node?: ts.Expression) =>
  node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : undefined;
const flag = (node?: ts.Expression) => node?.kind === ts.SyntaxKind.TrueKeyword || undefined;

// Only components and frame objects are frames; other exported values are helpers.
const isFrameValue = (value?: ts.Expression) =>
  Boolean(
    value && (ts.isArrowFunction(value) || ts.isFunctionExpression(value) || ts.isObjectLiteralExpression(value)),
  );
const frameObject = (value?: ts.Expression) => (value && ts.isObjectLiteralExpression(value) ? value : undefined);

const isExported = (statement: ts.Statement) =>
  ts.canHaveModifiers(statement) &&
  Boolean(ts.getModifiers(statement)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword));
const isDefaultExport = (statement: ts.Statement) =>
  ts.canHaveModifiers(statement) &&
  Boolean(ts.getModifiers(statement)?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword));

type FrameExport = { exportName: string; value?: ts.ObjectLiteralExpression };

// `export { Primary, Loading as Busy }`
const listedFrames = (index: SourceIndex, clause: ts.NamedExports): FrameExport[] =>
  clause.elements.flatMap((element) => {
    const local = (element.propertyName ?? element.name).getText(index.file);
    const exportName = element.name.getText(index.file);
    const value = resolveValue(index, index.declarations.get(local));
    const isFrame = exportName !== "default" && (index.functions.has(local) || isFrameValue(value));
    return isFrame ? [{ exportName, value: frameObject(value) }] : [];
  });

// `export const Primary = { ... }` and `export function Loading() { ... }`
const declaredFrames = (index: SourceIndex, statement: ts.Statement): FrameExport[] => {
  if (!isExported(statement)) return [];
  if (ts.isFunctionDeclaration(statement))
    return statement.name && !isDefaultExport(statement) ? [{ exportName: statement.name.text }] : [];
  if (!ts.isVariableStatement(statement)) return [];
  return statement.declarationList.declarations.flatMap((declaration) => {
    const value = resolveValue(index, declaration.initializer);
    return ts.isIdentifier(declaration.name) && isFrameValue(value)
      ? [{ exportName: declaration.name.text, value: frameObject(value) }]
      : [];
  });
};

/** Named exports that are frames, in source order, with their object literal when they have one. */
const frameExports = (index: SourceIndex) =>
  index.file.statements.flatMap((statement) => {
    if (!ts.isExportDeclaration(statement)) return declaredFrames(index, statement);
    const clause = statement.exportClause;
    return !statement.moduleSpecifier && clause && ts.isNamedExports(clause) ? listedFrames(index, clause) : [];
  });

export const indexCanvasFile = (path: string, source: string) => {
  const index = readSource(path, source);
  const meta = resolveValue(index, index.file.statements.find(ts.isExportAssignment)?.expression);
  const metaFullscreen = flag(property(index, meta, "fullscreen"));
  const metaTheme = text(property(index, meta, "defaultTheme"));
  const frames = frameExports(index).map(({ exportName, value }) => ({
    exportName,
    name: text(property(index, value, "name")) ?? sentenceCase(exportName),
    description: text(property(index, value, "description")),
    fullscreen: flag(property(index, value, "fullscreen")) ?? metaFullscreen,
    defaultTheme: text(property(index, value, "defaultTheme")) ?? metaTheme,
  }));
  const fileName = path
    .split("/")
    .at(-1)!
    .replace(/\.canvas\.[jt]sx$/, "");
  const title = text(property(index, meta, "title")) ?? fileName;
  const separator = title.lastIndexOf("/");
  return {
    title,
    group: separator < 0 ? "" : title.slice(0, separator),
    name: title.slice(separator + 1),
    description: text(property(index, meta, "description")),
    frames,
  };
};
