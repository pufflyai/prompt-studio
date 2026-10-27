// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./mermaid-renderer-DxExU8WG.ts";
import { c as t } from "./list-marker-width-plugin-q77pywDH.ts";
import { p as n, qn as r } from "./rich-text-theme-C7PhYVHR.ts";
import { t as i } from "./LexicalComposerContext.prod-C-LZ0eF8.ts";
import { useEffect as a, useState as o } from "react";
import { Box as s, Button as c, Flex as l, Textarea as u } from "@chakra-ui/react";
import { jsx as d, jsxs as f } from "react/jsx-runtime";
// packages/ui/src/components/rich-text/shared/plugins/MermaidPlugin/MermaidComponent.tsx
function p(p) {
	let { code: m, nodeKey: h } = p, [g] = i(), _ = n(), [v, y] = o(!1), [b, x] = o(m), [S, C] = o(m);
	return a(() => {
		x(m), C(m);
	}, [m]), v ? /* @__PURE__ */ f(s, {
		borderWidth: "1px",
		borderColor: "border.subtle",
		borderRadius: "md",
		overflow: "hidden",
		width: "100%",
		children: [/* @__PURE__ */ f(l, {
			justifyContent: "flex-end",
			alignItems: "center",
			gap: "xs",
			paddingX: "sm",
			paddingY: "xs",
			bg: "bg.muted",
			children: [/* @__PURE__ */ d(c, {
				size: "xs",
				variant: "subtle",
				onClick: () => {
					x(S), y(!1);
				},
				children: "Cancel"
			}), /* @__PURE__ */ d(c, {
				size: "xs",
				onClick: () => {
					g.update(() => {
						let e = r(h);
						t(e) && e.setCode(b);
					}), C(b), y(!1);
				},
				children: "Preview"
			})]
		}), /* @__PURE__ */ d(s, {
			padding: "sm",
			bg: "bg.muted",
			children: /* @__PURE__ */ d(u, {
				value: b,
				onChange: (e) => x(e.target.value),
				minHeight: "180px",
				resize: "vertical",
				fontFamily: "mono",
				fontSize: "sm",
				spellCheck: !1
			})
		})]
	}) : /* @__PURE__ */ d(e, {
		code: S,
		isEditable: _,
		onRequestEdit: _ ? () => y(!0) : void 0
	}, S);
}
export { p as default };
