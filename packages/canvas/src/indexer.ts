import ts from "typescript";

const bindings = (file: ts.SourceFile) => {
  const declarations = new Map<string, ts.Expression>();
  const imports = new Map<string, string>();
  for (const statement of file.statements) {
    if (ts.isVariableStatement(statement))
      for (const declaration of statement.declarationList.declarations)
        if (ts.isIdentifier(declaration.name) && declaration.initializer)
          declarations.set(declaration.name.text, declaration.initializer);
    if (
      ts.isImportDeclaration(statement) &&
      statement.importClause?.namedBindings &&
      ts.isNamedImports(statement.importClause.namedBindings)
    )
      for (const binding of statement.importClause.namedBindings.elements)
        imports.set(binding.name.text, (statement.moduleSpecifier as ts.StringLiteral).text);
  }
  return { declarations, imports };
};

export const indexExamples = (path: string, source: string) => {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const { declarations, imports } = bindings(file);
  const object = (node?: ts.Expression): ts.ObjectLiteralExpression | undefined => {
    if (!node) return;
    if (ts.isObjectLiteralExpression(node)) return node;
    if (ts.isSatisfiesExpression(node) || ts.isAsExpression(node) || ts.isParenthesizedExpression(node))
      return object(node.expression);
    if (ts.isIdentifier(node)) return object(declarations.get(node.text));
  };
  const property = (node: ts.ObjectLiteralExpression | undefined, key: string) => {
    const value = node?.properties.find(
      (property) => ts.isPropertyAssignment(property) && property.name.getText(file) === key,
    );
    return value && ts.isPropertyAssignment(value) ? value.initializer : undefined;
  };
  const text = (node?: ts.Expression) => (node && ts.isStringLiteral(node) ? node.text : undefined);
  const defaults = file.statements.find(ts.isExportAssignment);
  const meta = object(defaults?.expression);
  const component = property(meta, "component")?.getText(file);
  const stories: { exportName: string; id: string; name: string; defaultTheme?: string }[] = [];
  for (const statement of file.statements) {
    if (
      !ts.isVariableStatement(statement) ||
      !statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    )
      continue;
    for (const declaration of statement.declarationList.declarations) {
      const value = object(declaration.initializer);
      const id = text(property(value, "id"));
      if (!id) continue;
      const exportName = declaration.name.getText(file);
      const name = text(property(value, "name")) ?? exportName.replace(/([a-z\d])([A-Z])/g, "$1 $2");
      const defaultTheme = text(property(value, "defaultTheme")) ?? text(property(meta, "defaultTheme"));
      stories.push({ exportName, id, name, ...(defaultTheme ? { defaultTheme } : {}) });
    }
  }
  return {
    title: text(property(meta, "title")) ?? path.replace(/\.canvas\.tsx?$/, ""),
    component,
    componentImport: component ? imports.get(component) : undefined,
    stories,
  };
};
