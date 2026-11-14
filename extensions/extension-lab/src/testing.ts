/** Real example modules for host conformance tests; no installed runtime dependencies. */

export type { MarmaladeAction, MarmaladeViewState } from "./apps/marmalade/marmalade.types";
export { marmaladeCommands } from "./apps/marmalade/marmalade-commands";
export { marmaladeContext } from "./apps/marmalade/marmalade-persistence.test-fixture";
export { marmaladeKeys } from "./apps/marmalade/marmalade-storage";
export { createMarmaladeStore } from "./apps/marmalade/marmalade-store";
export type { ExampleProps } from "./view-context";
