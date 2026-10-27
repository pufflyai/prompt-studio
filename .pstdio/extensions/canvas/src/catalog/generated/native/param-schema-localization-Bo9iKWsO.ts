// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { commandRefId as e } from "@pstdio/sdk/extensions";
// packages/pstdio-workbench/src/extensions/contributions/param-schema-localization.ts
var t = (e, t, r) => {
	if (e) return Object.fromEntries(Object.entries(e).map(([e, i]) => [e, {
		...i,
		...i.options && !Array.isArray(i.options) ? { options: n(i.options, r) } : {},
		label: i.label === void 0 ? void 0 : t(i.label, e),
		description: i.description === void 0 ? void 0 : t(i.description)
	}]));
}, n = (t, n) => {
	let r = t;
	return {
		valueField: r.valueField,
		labelField: r.labelField,
		params: r.params,
		commandId: e({
			id: r.command.id,
			extensionId: r.command.extensionId ?? n ?? "pstdio"
		})
	};
};
export { t };
