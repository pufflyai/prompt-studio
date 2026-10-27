// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e } from "./collections-CVGR0OYX.ts";
import { n as t, t as n } from "./runtime-state-DUeC3JNx.ts";
// packages/pstdio-dashboard/src/shared/extensions/extension-webview-broadcast.ts
var r = n(), i = n(), a = n(), o = t(() => ({ tick: 0 }));
r.subscribe;
var s = i.subscribe, c = i.publish, l = a.subscribe, u = (t, n, i = e()) => {
	if (i.isDisposed()) return;
	let a = o(i);
	a.tick += 1;
	let s = {
		commandId: t.commandId,
		extensionId: t.extensionId,
		outcome: t.outcome,
		tick: a.tick
	};
	r.publish(s, i);
	for (let e of new Set(t.eventIds ?? [])) c({
		id: e,
		...n
	}, i);
};
export { s as n, l as r, u as t };
