// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./param-editor-field-DNMN3OG9.ts";
import { Box as t } from "@chakra-ui/react";
import { jsx as n } from "react/jsx-runtime";
// packages/ui/src/components/param-editor/param-editor-row.tsx
var r = (r) => {
	let { param: i, values: a = {}, onChange: o, onOpenResource: s, readOnly: c, fullWidth: l, variant: u = "default" } = r, d = u === "small";
	return /* @__PURE__ */ n(t, {
		px: "sm",
		py: d ? "2xs" : "xs",
		children: /* @__PURE__ */ n(e, {
			param: i,
			defaultValues: a,
			onChange: o ?? (() => void 0),
			onOpenResource: s,
			readOnly: c,
			fullWidth: l,
			size: d ? "xs" : "sm"
		})
	});
};
export { r as t };
