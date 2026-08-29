// One grammar for every author-declared local contribution id: lowercase kebab-case
// segments separated by single dots. Dots express local grouping (and derive default
// CLI paths); ownership always travels separately in a ref's `extensionId`.
export const localContributionIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

export const isValidLocalContributionId = (id: string) => localContributionIdPattern.test(id);

export const localContributionIdGrammar =
  'lowercase kebab-case segments separated by dots, such as "ticket-status.create"';
