# Extension navigation

The page-location controller owns routes, browser history, breadcrumbs, and location persistence. Pages declare an optional resource constraint independently from Main presentation. Resource kinds and views do not choose destinations.

Navigation targets name a page or panel explicitly. A page target can include a resource and a contextual parent target. A panel target preserves location and requires its owner to be active. `ResourceRef` retains type, id, optional label, and ownership throughout these APIs; URI conversion stays in location adapters.

Compound navigation contains page and panel targets only. Preparation resolves dependent targets against proposed page and placement state. Commit publishes final state as one batch and creates at most one browser history entry. Failed preparation has no observable navigation or composition effects. Commands and external links are standalone actions because their effects cannot participate in this transaction.

Serialization and the browser history write precede changes to live owners. Browser adapters must leave history unchanged when a write throws. Cache writes, mode hooks, and public subscribers run after this boundary. The workbench reports each failed host effect and continues notifying observers; an observer failure cannot reject an already committed route. Internal composition and breadcrumb updates finish before public subscribers run.

The visible layout composes shell, mode, and page placements. Page changes preserve shared mode placements. Closing an auxiliary panel preserves location. Native and webview closing use one controller that protects fixed placements and follows the page's declared parent when its last routed resource view closes.

See [composition architecture](extension-workbench-composition.md) and [navigation and layout state](../extensions/navigation-and-layout-state.md).
