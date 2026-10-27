// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { Text as e } from "@chakra-ui/react";
import { jsx as t } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/renderers/controls/harness-control.tsx
var n = (n) => {
	let { param: r, value: i, readOnly: a, renderParamField: o, onChange: s } = n;
	return o?.({
		entry: {
			key: r.id,
			label: r.name,
			description: r.description,
			type: "harness",
			required: !0
		},
		value: JSON.stringify(i),
		disabled: a || !!r.readOnly,
		onChange: (e) => {
			!a && !r.readOnly && typeof e == "string" && s(JSON.parse(e));
		}
	}) || /* @__PURE__ */ t(e, {
		textStyle: "label/S/regular",
		color: "fg.muted",
		children: "Harness selection is unavailable in this host."
	});
};
export { n as t };
