// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { d as e, h as t, m as n, p as r, r as i } from "./test-whhQHjQi.ts";
import { t as a } from "./scroll-area-I7hjn89T.ts";
import { t as o } from "./tree-list-Db4WJcm2.ts";
import { useRef as s, useState as c } from "react";
import { Box as l, Button as u, Stack as d } from "@chakra-ui/react";
import { jsx as f, jsxs as p } from "react/jsx-runtime";
// packages/ui/src/components/tree-list/tree-list-measurement.stories.tsx
var m = {
	title: "Components/Data Display/Tree List/Measurement",
	component: o
}, h = () => {
	let e = s(null), [t, n] = c(0);
	return /* @__PURE__ */ p(d, {
		w: "80",
		gap: "sm",
		children: [/* @__PURE__ */ f(u, {
			onClick: () => n(100),
			children: "Add sessions"
		}), /* @__PURE__ */ f(a, {
			height: "64",
			viewportRef: e,
			children: /* @__PURE__ */ f(o, {
				virtualize: !0,
				scrollRef: e,
				rowVariant: "compact",
				expandedSectionIds: ["sessions"],
				sections: [{
					id: "sessions",
					label: "Sessions",
					nodes: Array.from({ length: t }, (e, t) => ({
						id: `session-${t}`,
						label: `Session ${t + 1}`,
						isNavigable: !0
					}))
				}]
			})
		})]
	});
}, g = {
	tags: ["measurement-regression"],
	render: () => /* @__PURE__ */ f(h, {}),
	play: async ({ canvasElement: a }) => {
		let o = t(a), s = e(console, "error");
		try {
			await r.click(o.getByRole("button", { name: "Add sessions" })), await n(() => i(a.querySelector("[data-tree-list-focus-id=\"session-0\"]")).toBeVisible());
			let e = a.querySelector("[data-tree-list-focus-id=\"session-0\"]");
			await r.click(e), await r.keyboard("{End}"), await n(() => i(a.querySelector("[data-tree-list-focus-id=\"session-99\"]")).toHaveFocus()), await r.keyboard("{Home}"), await n(() => i(a.querySelector("[data-tree-list-focus-id=\"header:sessions\"]")).toHaveFocus()), i(s.mock.calls.filter((e) => e.some((e) => String(e).includes("flushSync")))).toEqual([]);
		} finally {
			s.mockRestore();
		}
	}
}, _ = Array.from({ length: 12 }, (e, t) => `row-${t}`), v = () => {
	let e = s(null), [t, n] = c(!1);
	return /* @__PURE__ */ p(d, {
		w: "80",
		gap: "sm",
		children: [/* @__PURE__ */ f(u, {
			onClick: () => n((e) => !e),
			children: t ? "Show list" : "Hide list"
		}), /* @__PURE__ */ f(l, {
			display: t ? "none" : "block",
			children: /* @__PURE__ */ f(a, {
				height: "96",
				viewportRef: e,
				children: /* @__PURE__ */ f(o, {
					virtualize: !0,
					scrollRef: e,
					rowVariant: "compact",
					expandedSectionIds: ["channels"],
					sections: [{
						id: "channels",
						label: "Channels",
						nodes: _.map((e, t) => ({
							id: e,
							label: `Channel ${t + 1}`,
							isNavigable: !0
						}))
					}]
				})
			})
		})]
	});
}, y = {
	tags: ["measurement-regression"],
	render: () => /* @__PURE__ */ f(v, {})
};
export { g as AddedRows, y as HiddenAndShown, m as default };
