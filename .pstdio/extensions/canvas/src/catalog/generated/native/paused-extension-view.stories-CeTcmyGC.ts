// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./circle-pause-B1jshF2F.ts";
import { t } from "./play-crlvkPMv.ts";
import { t as n } from "./useTranslation-DvWg4zeU.ts";
import { t as r } from "./paused-extensions-CHjmYZiy.ts";
import { useEffect as i, useRef as a, useState as o } from "react";
import { Box as s, Button as c, Center as l, HStack as u, Text as d } from "@chakra-ui/react";
import { EmptyState as f } from "@pstdio/ui";
import { jsx as p, jsxs as m } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/shared/extensions/components/paused-extension-view.tsx
var h = 160, g = {
	title: "Extensions/Paused extension view",
	component: (g) => {
		let { installedExtensionId: _, name: v } = g, { t: y } = n("settings"), b = a(null), [x, S] = o(!1);
		i(() => {
			let e = b.current;
			if (!e) return;
			let t = new ResizeObserver(([e]) => S((e?.contentRect.height ?? 0) < h));
			return t.observe(e), () => t.disconnect();
		}, []);
		let C = () => r.resume(_);
		return /* @__PURE__ */ p(s, {
			ref: b,
			h: "full",
			w: "full",
			"data-testid": "paused-extension-view",
			children: x ? /* @__PURE__ */ m(u, {
				h: "full",
				paddingX: "sm",
				gap: "xs",
				color: "fg.muted",
				children: [
					/* @__PURE__ */ p(e, { size: 14 }),
					/* @__PURE__ */ p(d, {
						textStyle: "label/S/regular",
						truncate: !0,
						children: y("performance.paused.title", { name: v })
					}),
					/* @__PURE__ */ m(c, {
						size: "2xs",
						variant: "ghost",
						onClick: C,
						children: [/* @__PURE__ */ p(t, {}), y("performance.popover.resume")]
					})
				]
			}) : /* @__PURE__ */ p(l, {
				h: "full",
				children: /* @__PURE__ */ p(f, {
					icon: /* @__PURE__ */ p(e, {}),
					title: y("performance.paused.title", { name: v }),
					description: y("performance.paused.body"),
					children: /* @__PURE__ */ m(c, {
						size: "sm",
						variant: "outline",
						onClick: C,
						children: [/* @__PURE__ */ p(t, {}), y("performance.popover.resume")]
					})
				})
			})
		});
	},
	args: {
		installedExtensionId: "shader",
		name: "Shader Lab"
	}
}, _ = { decorators: [(e) => /* @__PURE__ */ p(s, {
	h: "2xl",
	w: "full",
	borderWidth: "1px",
	borderColor: "border.subtle",
	children: /* @__PURE__ */ p(e, {})
})] }, v = { decorators: [(e) => /* @__PURE__ */ p(s, {
	h: "10",
	w: "full",
	borderWidth: "1px",
	borderColor: "border.subtle",
	children: /* @__PURE__ */ p(e, {})
})] };
export { v as Chrome, _ as Panel, g as default };
