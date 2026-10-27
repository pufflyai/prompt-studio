// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { w as e } from "./workbench-core-N58OeDyx.ts";
// packages/pstdio-workbench/src/react/menus/menu-item-state.ts
var t = (t, n, r, i) => {
	if (!e(r, t.when) || !e(r, n.command.when) || n.handler.isVisible?.(t.args, i) === !1) return;
	let a = t.readOnly === !0 || !!(t.disabledWhen && e(r, t.disabledWhen)), o = t.description ?? n.command.description;
	return {
		readOnly: a,
		disabled: a || n.handler.isEnabled?.(t.args, i) === !1,
		description: a ? t.disabledReason ?? o : o
	};
};
export { t };
