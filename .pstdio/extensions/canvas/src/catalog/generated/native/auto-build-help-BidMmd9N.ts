// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./arrow-up-right-CUuzCgQb.ts";
import { t } from "./info-D1px5mME.ts";
import { Icon as n, IconButton as r, Link as i, Popover as a, Stack as o, Text as s } from "@chakra-ui/react";
import { jsx as c, jsxs as l } from "react/jsx-runtime";
// extensions/pstdio-planner/src/timeline/view/auto-build-help.tsx
function u(u) {
	let { t: d } = u;
	return /* @__PURE__ */ l(a.Root, {
		positioning: {
			placement: "bottom-start",
			strategy: "fixed",
			hideWhenDetached: !0
		},
		children: [/* @__PURE__ */ c(a.Trigger, {
			asChild: !0,
			children: /* @__PURE__ */ c(r, {
				size: "xs",
				variant: "ghost",
				"aria-label": d("timeline.autoBuild.about", "About Auto Build"),
				children: /* @__PURE__ */ c(t, {})
			})
		}), /* @__PURE__ */ c(a.Positioner, { children: /* @__PURE__ */ c(a.Content, { children: /* @__PURE__ */ c(a.Body, { children: /* @__PURE__ */ l(o, {
			gap: "sm",
			children: [/* @__PURE__ */ c(s, {
				textStyle: "paragraph/S/regular",
				children: d("timeline.autoBuild.description", "A supervisor uses your prompt to assign valid, unassigned tickets as capacity becomes available. It sleeps between checks and resumes when more work can run.")
			}), /* @__PURE__ */ l(i, {
				variant: "underline",
				href: "https://prompt.studio/docs/extensions/planner/auto-build/",
				target: "_blank",
				rel: "noopener noreferrer",
				children: [d("timeline.autoBuild.documentation", "Auto Build documentation"), /* @__PURE__ */ c(n, {
					as: e,
					boxSize: "icon-xs"
				})]
			})]
		}) }) }) })]
	});
}
export { u as t };
