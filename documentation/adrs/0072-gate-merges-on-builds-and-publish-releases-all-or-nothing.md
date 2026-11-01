# Publish releases from one verified commit

Proposed: 2026-10-12

Status: Accepted for publication and tag rules. [Current CI stages](0129-prioritize-merge-checks-and-certify-release-candidates.md) own execution placement; [SDK/UI previews](0107-independent-sdk-ui-previews.md) add a packages-only channel.

## Context

Publishing npm packages before desktop builds left partially shipped versions that normal retries skipped. Version 0.41.0 received no tag or GitHub release. A separately triggered rehearsal also failed to protect an approved bot-pushed release PR.

## Decision

1. Build and verify the release artifacts from one commit before publishing. Apply each channel's validation requirements from the current CI-stage decision.
2. Publish npm packages first and the GitHub release last. The published GitHub release is the completion marker. Steps skip already completed work so failed publication can resume.
3. Before any package exists on npm, an unpublished tag may move forward to the newest main commit. An older rerun must never move it back.
4. Once any package of that version is published, including a CLI platform package, freeze the tag and finish from that commit. Never combine npm and desktop artifacts from different commits.
5. Dry-run package publication before publishing the first package so packing errors cannot strand a version.
6. Exercise the release path through nightlies instead of a separately triggered rehearsal.

## Consequences

- Resuming an older commit uses the current workflow with that commit's scripts. If incompatible, release a new version instead of mixing revisions.
- The pipeline runs from main because trusted npm publication and Windows signing trust main and release tags.
- Nightly and stable validation depth differs, but both retain artifact integrity and all-or-nothing publication.
- ADR 0087's intermediate PR/queue policy and this record's original stage layout were retired; the current CI decision records their failure history.
