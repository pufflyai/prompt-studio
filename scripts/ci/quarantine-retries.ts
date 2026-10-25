import ts from "typescript";

const optionKey = (name: ts.PropertyName | undefined) => {
  if (!name) return;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  if (ts.isComputedPropertyName(name) && ts.isStringLiteral(name.expression)) return name.expression.text;
};
const validateOption = (property: ts.ObjectLiteralElementLike) => {
  const key = optionKey(property.name);
  if (key !== "retry" && key !== "repeats") return;
  const value = ts.isPropertyAssignment(property) ? property.initializer : undefined;
  if (value && ts.isNumericLiteral(value) && Number(value.text) === 0) return;
  throw new Error("Quarantine test options cannot retry or repeat execution");
};

// Bun's JUnit output hides successful retries. Enforce the rule before execution.
export const assertNoQuarantineRetries = (source: string, args: string[]) => {
  if (args.some((arg) => /^--(?:retry|rerun-each)(?:=|$)/.test(arg)))
    throw new Error("Quarantine must execute once; retry and rerun flags are not allowed");
  const file = ts.createSourceFile("quarantine.test.ts", source, ts.ScriptTarget.Latest, true);
  const bindings = new Map<string, ts.Expression>();
  const testNames = new Set<string>();
  const namespaces = new Set<string>();
  const collectImport = (node: ts.ImportDeclaration) => {
    const imports = node.importClause?.namedBindings;
    if (imports && ts.isNamespaceImport(imports)) namespaces.add(imports.name.text);
    if (imports && ts.isNamedImports(imports))
      for (const item of imports.elements)
        if (["test", "it"].includes((item.propertyName ?? item.name).text)) testNames.add(item.name.text);
  };
  const collect = (node: ts.Node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === "bun:test"
    ) {
      collectImport(node);
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer)
      bindings.set(node.name.text, node.initializer);
    ts.forEachChild(node, collect);
  };
  collect(file);
  const reference = (expression: ts.Expression, seen: Set<string>) => {
    if (!ts.isIdentifier(expression) || seen.has(expression.text)) return [];
    seen.add(expression.text);
    const value = bindings.get(expression.text);
    return value ? [value] : [];
  };
  const testChildren = (expression: ts.Expression, seen: Set<string>) => {
    if (ts.isIdentifier(expression)) return reference(expression, seen);
    if (ts.isPropertyAccessExpression(expression) || ts.isCallExpression(expression)) return [expression.expression];
    if (ts.isConditionalExpression(expression)) return [expression.whenTrue, expression.whenFalse];
    return [];
  };
  const testCall = (expression: ts.Expression) => {
    const pending = [expression];
    const seen = new Set<string>();
    while (pending.length) {
      const current = pending.pop()!;
      if (ts.isIdentifier(current) && testNames.has(current.text)) return true;
      if (
        ts.isPropertyAccessExpression(current) &&
        ts.isIdentifier(current.expression) &&
        namespaces.has(current.expression.text) &&
        ["test", "it"].includes(current.name.text)
      )
        return true;
      pending.push(...testChildren(current, seen));
    }
    return false;
  };
  const options = (expression: ts.Expression) => {
    const pending = [expression];
    const seen = new Set<string>();
    while (pending.length) {
      const current = pending.pop()!;
      if (ts.isIdentifier(current)) pending.push(...reference(current, seen));
      if (!ts.isObjectLiteralExpression(current)) continue;
      for (const property of current.properties) {
        if (ts.isSpreadAssignment(property)) pending.push(property.expression);
        else validateOption(property);
      }
    }
  };
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && testCall(node.expression))
      for (const argument of node.arguments.slice(1)) options(argument);
    ts.forEachChild(node, visit);
  };
  visit(file);
};
