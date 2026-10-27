// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./extension-navigation-target-zjAG34BD.ts";
// packages/pstdio-workbench/src/extensions/contributions/collection-badge-navigation.ts
var t = (t, n, r, i, a) => {
	let o = t.attributes[n]?.find((e) => e.id === r), s = o?.action ?? o?.target;
	return s ? e(s, {
		extensionId: i,
		projectId: a
	}) : void 0;
};
export { t };
