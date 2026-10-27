// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e } from "./workbench-core-N58OeDyx.ts";
// packages/pstdio-workbench/src/react/menus/resource-action-menu.ts
var t = (t, n, r) => {
	let i = t.resources.getKind(n.type, n.extensionId), a = i?.resolve ? i.resolve(n) : n, o = a ? t.resources.preview.resolve(a) : void 0;
	if (o) return {
		workbench: t,
		menuPath: e(o.type),
		context: { resource: o },
		onRequestParams: r ?? (({ request: e }) => t.commandPalette.requestParams(e)),
		group: {
			id: `resource:${o.extensionId ?? "pstdio"}:${o.type}`,
			label: i?.label ?? o.type
		}
	};
}, n = (e, t) => {
	let n = e.flatMap((e) => e.subscribe ? [e.subscribe(t)] : []);
	return () => {
		for (let e of n) typeof e == "function" ? e() : e.dispose();
	};
}, r = (e, t) => {
	let r = n(e.resources.listKinds(), t), i = [
		e.resources.preview.store.subscribeSelector((e) => e.changes, t),
		e.resources.store.subscribeSelector((e) => e.kinds, () => {
			r(), r = n(e.resources.listKinds(), t), t();
		}),
		e.commands.store.subscribeSelector((e) => e.commands, t),
		e.context.store.subscribeSelector((e) => e.values, t),
		e.layout.menuStore.subscribeSelector((e) => e.itemsByPath, t)
	];
	return () => {
		r();
		for (let e of i) e();
	};
};
export { r as n, n as r, t };
