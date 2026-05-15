---
"@pstdio/ui": patch
---

`TreeList` virtualized renderer now seeds `useVirtualizer` with the live `scrollRef.current.clientHeight` (falling back to a one-shot 384px hint only when the ref hasn't attached yet). Without an initial rect the first computation could return zero virtual items, leaving the tree blank until a layout-affecting re-render landed.
