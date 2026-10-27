// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { i as e } from "./command-palette-params-BB-3_RFH.ts";
import { r as t, t as n } from "./command-param-descriptors-DkvKpi2f.ts";
import { jsx as r } from "react/jsx-runtime";
import { ParamEditorRow as i } from "@pstdio/ui/param-editor";
// packages/pstdio-workbench/src/react/command-palette/command-param-field.tsx
var a = (a) => {
	let { entry: o, value: s, disabled: c, onChange: l } = a, u = (n) => {
		let r = t(n, o);
		if (o.type !== "files" || !e(s) || !e(r)) {
			l(r);
			return;
		}
		let i = o.multiple === !1 && r.uploads.length > 0 ? [] : s.refs;
		l({
			...r,
			refs: i
		});
	};
	return /* @__PURE__ */ r(i, {
		param: n(o, s),
		readOnly: c,
		onChange: (e, t) => u(t)
	});
};
export { a as t };
