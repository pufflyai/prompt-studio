# Temporary KaTeX security override

Proposed: 2026-10-06

## Status

Accepted temporary workaround for PS-524.

## Intended design

Each dependency should request a patched KaTeX release through its own version range.
Bun should resolve those ranges without a root override.

## External limitation

KaTeX versions >= 0.11.0 and < 0.18.2 can read render options from a polluted
object prototype. An inherited `trust` option can enable unsafe rendering.
The fix is available from 0.18.2.

Mermaid 11.16.1 requests `katex ^0.16.45`, and micromark-extension-math 3.1.0
requests `katex ^0.16.0`. Neither range accepts a patched release. Updating our
direct KaTeX dependency alone leaves vulnerable transitive copies in the graph.
A clean resolution needs upstream releases with patched dependency ranges.

## Temporary workaround

Request `katex ^0.19.0` in `@pstdio/ui` and override KaTeX to the same range in
the root package manifest. Bun locks one copy at 0.19.0 for direct and transitive
consumers. Update Astro and sharp through their supported ranges separately.

## Isolation and limitations

The workaround lives only in the root dependency override and lockfile. It adds
no rendering flags, application state, or vendored dependency code.

The override crosses the transitive consumers' declared version ranges. KaTeX
changes to internal APIs, CSS classes, and warning handling require compatibility
checks when upgrading it. Validate equation rendering, Mermaid rendering, the UI
build, and packaged output. Our equation styles use `.katex-display`, which the
upgrade preserves.

Root overrides apply to this workspace and its builds. They do not travel with
the published `@pstdio/ui` package. Projects that install that package need their
own KaTeX override until the transitive consumers accept patched versions.

## Removal

Remove the root KaTeX override when compatible Mermaid and micromark-extension-math
releases resolve only patched KaTeX versions without it. Update those consumers,
regenerate `bun.lock`, and confirm no KaTeX version below 0.18.2 remains. Repeat
the rendering checks and packaged verification before removing the override.
Keep the direct UI dependency on a patched release.

## References

- [KaTeX security advisory](https://github.com/advisories/GHSA-238p-pmpm-9mq7).
- [KaTeX 0.19 release notes](https://github.com/KaTeX/KaTeX/releases/tag/v0.19.0).
- [Dependency override](../../package.json).
- [UI dependency](../../packages/ui/package.json).
- [Dependabot update PR](https://github.com/pufflyai/prompt-studio/pull/917).
