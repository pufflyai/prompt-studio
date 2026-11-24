export const treeStateKey = (rendererId: string, scope?: string) =>
  scope ? JSON.stringify(["tree-scope", scope]) : rendererId;
