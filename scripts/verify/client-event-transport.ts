import ts from "typescript";

const owners = new Set([
  "packages/sdk/src/client/sync.ts",
  "packages/sdk/src/client/session-stream.ts",
  "packages/sdk/src/client/sse.ts",
]);
const clientOwners = new Set([
  "packages/sdk/src/client/client.ts",
  "packages/pstdio-dashboard/src/lib/api.ts",
  "packages/pstdio-dashboard/src/lib/sync/sync-client.ts",
]);
const assets = new Set(["packages/sdk/src/client/assets.ts", "packages/sdk/src/client/asset-source.ts"]);
const importsTransport = (node: ts.Node, file: string) => {
  if (!ts.isImportDeclaration(node) || node.importClause?.isTypeOnly || !ts.isStringLiteral(node.moduleSpecifier))
    return false;
  const module = node.moduleSpecifier.text;
  if (/(?:^|\/)sse(?:\.[jt]s)?$/.test(module)) return true;
  return file !== "packages/sdk/src/client/client.ts" && /(?:^|\/)session-stream(?:\.[jt]s)?$/.test(module);
};
const consumesStream = (node: ts.Node, parsed: ts.SourceFile) => {
  if (ts.isPropertyAccessExpression(node)) return node.name.text === "getReader";
  if (ts.isElementAccessExpression(node))
    return ts.isStringLiteralLike(node.argumentExpression) && node.argumentExpression.text === "getReader";
  return (
    ts.isPropertyAssignment(node) &&
    node.name.getText(parsed).replaceAll(/["']/g, "") === "response" &&
    ts.isStringLiteralLike(node.initializer) &&
    node.initializer.text === "stream"
  );
};
const createsConnection = (node: ts.Node, file: string) => {
  if (ts.isIdentifier(node)) {
    if (ts.isTypeReferenceNode(node.parent) || ts.isExportSpecifier(node.parent)) return false;
    if (node.text === "EventSource") return true;
    if (node.text === "createClient" && !clientOwners.has(file)) return true;
  }
  if (!ts.isStringLiteralLike(node)) return false;
  return node.text.toLowerCase() === "text/event-stream" || node.text === "EventSource";
};

/** Enforce known event-creation entry points; the browser budget also checks unknown endpoints. */
export const clientEventTransportViolations = (file: string, source: string) => {
  if (!/^(?:packages\/(?:sdk|ui|pstdio-dashboard|pstdio-workbench)\/src\/|extensions\/[^/]+\/src\/)/.test(file))
    return [];
  if (
    /\.(?:p\d\.(?:test|spec)|test-utils|test-helpers|test-fixture|canvas)\.[cm]?[jt]sx?$/.test(file) ||
    /\/(?:mocks|__tests__)\//.test(file)
  )
    return [];
  if (owners.has(file)) return [];
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const errors: string[] = [];
  const report = (node: ts.Node) => {
    const { line } = parsed.getLineAndCharacterOfPosition(node.getStart(parsed));
    errors.push(
      `${file}:${line + 1}: use the shared client event transport; only sync.ts and session-stream.ts own event connections`,
    );
  };
  const visit = (node: ts.Node) => {
    if (ts.isTypeNode(node)) return;
    if (ts.isImportDeclaration(node) && node.importClause?.isTypeOnly) return;
    if (ts.isImportSpecifier(node) && node.isTypeOnly) return;
    if (importsTransport(node, file) || createsConnection(node, file)) report(node);
    if (!assets.has(file) && consumesStream(node, parsed)) report(node);
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  return [...new Set(errors)];
};
