const numericIdentifier = "(?:0|[1-9]\\d*)";
const caretTerm = new RegExp(`^\\^(${numericIdentifier}\\.${numericIdentifier}\\.${numericIdentifier})$`);

/**
 * Only caret terms are accepted because each one stops below the next breaking version, so a
 * declaration can never claim support for a breaking API that did not exist when it was written.
 * Returns the minimum API version of each term.
 */
export const parseExtensionApiDeclaration = (declaration: string) => {
  const minimums = declaration.split("||").map((term) => caretTerm.exec(term.trim())?.[1]);
  return minimums.every((minimum): minimum is string => minimum !== undefined) ? minimums : null;
};

export const supportsExtensionApiVersion = (declaration: string, hostVersion: string) => {
  const minimums = parseExtensionApiDeclaration(declaration);
  // Rebuilt from the parsed terms because semver range syntax does not accept every whitespace `trim` removes.
  return minimums !== null && Bun.semver.satisfies(hostVersion, minimums.map((minimum) => `^${minimum}`).join(" || "));
};
