export class InvalidWorkspaceShorthandError extends Error {}

export const assertWorkspaceShorthand = (value: string) => {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value)) {
    throw new InvalidWorkspaceShorthandError(
      "Workspace shorthand must start with a letter or number and contain only letters, numbers, hyphens, or underscores.",
    );
  }
};
