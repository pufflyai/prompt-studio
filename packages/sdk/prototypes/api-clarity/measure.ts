import ts from "typescript";
import type { Task } from "./contracts";

const controlFlow = new Set([
  ts.SyntaxKind.IfStatement,
  ts.SyntaxKind.CatchClause,
  ts.SyntaxKind.ForOfStatement,
  ts.SyntaxKind.ForStatement,
  ts.SyntaxKind.WhileStatement,
  ts.SyntaxKind.DoStatement,
  ts.SyntaxKind.ConditionalExpression,
  ts.SyntaxKind.SwitchStatement,
]);

const tokenCount = (node: ts.Node, file: ts.SourceFile) => {
  const pending = [node];
  let count = 0;
  while (pending.length) {
    const current = pending.pop();
    if (!current) break;
    if (current.kind >= ts.SyntaxKind.FirstToken && current.kind <= ts.SyntaxKind.LastToken) count++;
    else pending.push(...current.getChildren(file));
  }
  return count;
};

export const measureSource = (source: string) => {
  const file = ts.createSourceFile("tasks.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const results = new Map<
    Task,
    { tokens: number; calls: number; fields: number; objectDepth: number; controlFlow: number }
  >();
  for (const statement of file.statements) {
    if (!ts.isFunctionDeclaration(statement) || !statement.body || !statement.name) continue;
    const tokens = tokenCount(statement.body, file);
    const counts = { tokens, calls: 0, fields: 0, objectDepth: 0, controlFlow: 0 };
    const visit = (node: ts.Node, depth: number) => {
      const nextDepth = depth + Number(ts.isObjectLiteralExpression(node));
      counts.objectDepth = Math.max(counts.objectDepth, nextDepth);
      if (ts.isCallExpression(node)) counts.calls++;
      if (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) counts.fields++;
      if (controlFlow.has(node.kind)) counts.controlFlow++;
      ts.forEachChild(node, (child) => visit(child, nextDepth));
    };
    visit(statement.body, 0);
    results.set(statement.name.text as Task, counts);
  }
  return results;
};
