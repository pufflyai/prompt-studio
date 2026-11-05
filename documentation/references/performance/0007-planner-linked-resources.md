# Tickets with linked resources

The manual fixture creates a board with **200 tickets**, each linked to a real Git
workspace, a synthetic GitHub pull request, and a synthetic CI build. The 600 links
include both directions. Custom resources belong to an installed fixture extension
using the public resource-kind resolver and page-navigation contracts. No GitHub
account or network requests are needed. This fixture does not measure startup time.

## Inspect the board in the isolated app

```sh
bun packages/e2e/src/perf/planner-linked-resources.diagnostic.ts
```

The launcher builds current host assets, prepares local SDK/UI packages and starts a fresh `dev:playwright`
Docker stack with Planner and the Codex harness. Stop any previous `dev:playwright`
stack first. Open the printed Board URL, which includes a single-use browser login.
Select the **200 linked tickets** view if it is not
already selected. Each ticket has workspace, PR and build badges. The PR and build
pages are synthetic destinations; this fixture does not implement the GitHub
integration. The seeder refuses a board that already contains tickets.

After inspection, stop the disposable stack and remove its state:

```sh
bun run dev:playwright:down
```
