// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import e from "react";
// node_modules/.bun/zustand@5.0.11+be264fab3a56f9d1/node_modules/zustand/esm/react.mjs
var t = (e) => e;
function n(n, r = t) {
	let i = e.useSyncExternalStore(n.subscribe, e.useCallback(() => r(n.getState()), [n, r]), e.useCallback(() => r(n.getInitialState()), [n, r]));
	return e.useDebugValue(i), i;
}
// packages/pstdio-workbench/src/react/shared/use-workbench-store.ts
var r = (e, t) => n(e, t);
export { n, r as t };
