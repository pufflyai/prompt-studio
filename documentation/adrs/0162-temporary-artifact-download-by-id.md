# Temporary artifact download by ID

Proposed: 2026-11-21

Status: Accepted.

## Intended design

Workflows pass immutable artifact IDs between jobs and runs, and download each one with `actions/download-artifact@v4` using `artifact-ids`. The ID identifies the artifact globally, so the download should not depend on how many other artifacts the run has.

## External limitation

`download-artifact@v4` resolves `artifact-ids` by first listing the run's artifacts, then filtering that list. When it lists through the REST API (with `github-token` and `run-id`), it works out the page count from the first page's `total_count` and can stop after 100 artifacts ([actions/download-artifact#441](https://github.com/actions/download-artifact/issues/441), open). Release runs now hold 160–162 artifacts. In [release run 44866048069](https://github.com/pufflyai/prompt-studio/actions/runs/44866048069), `production / signed_functional / functional (darwin-arm64)` logged `Found 100 artifact(s)` and then `None of the provided artifact IDs were found` for artifact 14691997962, although that artifact belongs to the run. Other steps in the same run listed 158–160 artifacts, so the failure is intermittent. The action has no input that skips the listing.

## Temporary workaround

The local `.github/actions/download-artifact-by-id` action replaces every `artifact-ids` download outside the frozen benchmark workflows. For each ID, it reads `GET /repos/{owner}/{repo}/actions/artifacts/{id}`, then downloads `/zip` and follows the storage redirect without the token. It keeps download-artifact's layout: `merge-multiple: true` extracts into `path`, and otherwise each artifact goes to `path/<artifact name>`. It requires the artifact to belong to `run-id`, which defaults to the current run as download-artifact did. It fails on missing or expired IDs and warns on a digest mismatch, also as download-artifact did.

The action runs on the runner's own Node 24, which strips the TypeScript types, so it needs no build step, no dependencies and no Bun. It works on Linux, macOS, Windows and in job containers such as the Playwright image, which has no `unzip`. It reads ZIP archives with `node:zlib`. Jobs whose checkout can be an older candidate sparsely check out the action from `github.workflow_sha`. Composite actions use the copy from their own checkout.

Jobs that used the runner's internal artifact service now call the REST API with `GITHUB_TOKEN`, so the `edited_tests` job gains `actions: read`.

## Limitations

The action extracts only stored and deflated entries, and refuses ZIP64 archives. Artifacts stay under 600 MB. Steps that download by `name` use a filtered lookup instead of the full listing, so this change leaves them unchanged. Same-run `pattern` downloads also stay on download-artifact: they list through the internal artifact service, which returned all 158–160 artifacts in the release run above. Cross-run `pattern` downloads read merge-queue runs that hold 35–74 artifacts. `production-desktop.yml`, `production-performance.yml` and `source-benchmarks.yml` belong to the frozen benchmark catalog. Their `artifact-ids` steps still use download-artifact until a benchmark-labeled PR converts them.

## Removal

Return to `actions/download-artifact` with `artifact-ids` when a release fixes #441 by fetching IDs directly or paginating without `total_count`. Before removing this action, confirm in a release run with more than 100 artifacts that every converted step still downloads.
