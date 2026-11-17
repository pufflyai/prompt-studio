# GitHub

GitHub owns reusable pull request resources, discovery by URL, opening and fresh remote evidence. Planner owns ticket progress, submitted revisions and dependency decisions.

In Related resources, choose Link resource and paste a GitHub PR URL. Choose Context for reference or Result for implementation evidence. A reference alone never approves or completes work. Removing a relationship leaves the remote PR unchanged.

```sh
pst pstdio.github pull-requests import --url https://github.com/acme/tools/pull/12
pst pstdio.github pull-requests read --ids '["https://github.com/acme/tools/pull/12"]'
pst resources link --from '{"type":"ticket","id":"TICKET_ID","extensionId":"pstdio.pstdio-planner"}' --to '{"type":"pull-request","id":"https://github.com/acme/tools/pull/12","extensionId":"pstdio.github"}' --role result
```

PR identities include host, repository and number and are scoped to the current project. Import is idempotent and does not require network access. New catalog identities emit `pull-requests.changed` after persistence so open discovery surfaces refresh. URL discovery also works before import. Opening a resource shows its repository, number and an external GitHub link; this is not a review interface.

Public commands `pull-requests.import`, `pull-requests.read` (at most 100 IDs), and `pull-requests.find-merged` (at most 100 branches) are available through `commandRef.forExtension({ publisher: "pstdio", name: "github" })`. Reads return current GitHub data or an error per identity, never cached merge or CI evidence. Authenticate the GitHub CLI on the machine running the extension. Concurrent reads of a shared PR are coalesced; remote processes are capped at eight across concurrent provider commands.

Planner migrates saved GitHub review links to result relationships before removing their legacy representation. It keeps non-GitHub URLs. Failed imports or relationship writes leave old links intact for a later attempt. Disabling this extension preserves generic relationships and their saved labels. Automation cannot treat missing evidence as a verified delivery.
