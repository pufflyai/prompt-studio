# Batched webview styles follow build metadata

## When to use

- Changing webview bundling, published assets, or stylesheet resolution.

## Failure

- Batched webviews can share a stylesheet whose name matches another JavaScript entry. Publishing `module.js` without recording that stylesheet leaves the iframe with no CSS, even when components generate some styles at runtime.

## Prevention

- Take the CSS filename from each JavaScript entry's `cssBundle` metadata. Keep that association with the prepared artifact and verify two views that share their CSS.

## Evidence

- [Prepared webview regression](../../packages/pstdio-api/src/features/extensions/prepared-webview.p0.test.ts)
