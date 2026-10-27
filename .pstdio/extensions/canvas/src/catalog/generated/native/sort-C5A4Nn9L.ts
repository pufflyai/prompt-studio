// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
// extensions/pstdio-planner/src/utils/sort.ts
var e = (e, t) => e.sortOrder - t.sortOrder || (e.name ?? "").localeCompare(t.name ?? "") || (e.id ?? "").localeCompare(t.id ?? ""), t = (t) => [...t].sort(e);
export { t as n, e as t };
