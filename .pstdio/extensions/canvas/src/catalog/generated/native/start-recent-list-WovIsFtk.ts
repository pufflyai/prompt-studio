// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./icon-D3uE7jD-.ts";
import { Box as t, Link as n, Stack as r, Text as i } from "@chakra-ui/react";
import { ListRow as a } from "@pstdio/ui";
import { jsx as o, jsxs as s } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/modules/start/components/start-about-panel.tsx
var c = "https://prompt.studio", l = () => /* @__PURE__ */ o(t, {
	borderWidth: "1px",
	borderColor: "border",
	bg: "bg.subtle",
	rounded: "sm",
	p: "lg",
	minW: "0",
	children: /* @__PURE__ */ s(r, {
		gap: "sm",
		minW: "0",
		children: [
			/* @__PURE__ */ o(i, {
				textStyle: "label/M/regular",
				children: "A workbench for your tools."
			}),
			/* @__PURE__ */ o(i, {
				textStyle: "paragraph/S/regular",
				color: "fg.muted",
				children: "Coding agents can build tools to help with your work. Prompt Studio gives them a place to live, with the shared infrastructure they need to work together."
			}),
			/* @__PURE__ */ s(n, {
				href: c,
				target: "_blank",
				rel: "noreferrer",
				color: "fg.info",
				textStyle: "label/S/regular",
				gap: "xs",
				alignSelf: "flex-start",
				children: [/* @__PURE__ */ o(e, {
					name: "external-link",
					size: 14
				}), "prompt.studio"]
			})
		]
	})
}), u = (t) => {
	let { actions: a } = t;
	return /* @__PURE__ */ s(r, {
		gap: "sm",
		minW: "0",
		children: [/* @__PURE__ */ o(i, {
			textStyle: "label/L/regular",
			children: "Start"
		}), /* @__PURE__ */ o(r, {
			gap: "sm",
			minW: "0",
			align: "flex-start",
			children: a.map((t) => /* @__PURE__ */ s(n, {
				role: "link",
				tabIndex: 0,
				color: "fg.info",
				textStyle: "label/S/regular",
				gap: "xs",
				onClick: t.run,
				onKeyDown: (e) => {
					e.key === "Enter" && (e.preventDefault(), t.run());
				},
				children: [/* @__PURE__ */ o(e, {
					name: t.icon,
					size: 14
				}), t.label]
			}, t.id))
		})]
	});
}, d = (n) => {
	let { resources: c, onOpen: l } = n;
	return /* @__PURE__ */ s(r, {
		gap: "sm",
		minW: "0",
		children: [/* @__PURE__ */ o(i, {
			textStyle: "label/L/regular",
			children: "Recent"
		}), /* @__PURE__ */ s(r, {
			gap: "none",
			minW: "0",
			children: [c.map((t) => /* @__PURE__ */ o(a, {
				role: "button",
				id: t.id,
				label: t.title,
				tooltip: t.title,
				icon: /* @__PURE__ */ o(e, {
					name: t.icon,
					size: 14
				}),
				onActivate: () => l(t)
			}, t.id)), c.length === 0 ? /* @__PURE__ */ o(t, {
				px: "sm",
				py: "md",
				children: /* @__PURE__ */ o(i, {
					textStyle: "label/S/regular",
					color: "fg.muted",
					children: "Nothing opened yet"
				})
			}) : null]
		})]
	});
};
export { u as n, l as r, d as t };
