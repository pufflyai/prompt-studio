// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./circle-B0quX-xX.ts";
import { t } from "./useTranslation-DvWg4zeU.ts";
import { a as n, s as r, t as i } from "./test-CYwQ_LKY.ts";
import { useState as a } from "react";
import { Box as o, Button as s, Icon as c, Stack as l } from "@chakra-ui/react";
import { Tooltip as u } from "@pstdio/ui";
import { jsx as d, jsxs as f } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/lib/sync/backend-connection-status.tsx
var p = (n) => {
	let { connected: r } = n, { t: i } = t("common"), a = i(r ? "connection.connected" : "connection.lost");
	return /* @__PURE__ */ d(u, {
		content: a,
		closeDelay: 150,
		positioning: { placement: "top-end" },
		children: /* @__PURE__ */ f(s, {
			as: "span",
			variant: "ghost",
			size: "2xs",
			color: r ? "fg.success" : "fg.error",
			tabIndex: 0,
			role: "status",
			"aria-label": a,
			children: [/* @__PURE__ */ d(c, {
				as: e,
				boxSize: "status-dot",
				fill: "currentColor",
				strokeWidth: 0,
				"aria-hidden": "true"
			}), !r && i("connection.unavailable")]
		})
	});
}, m = () => {
	let [e, t] = a(!1);
	return /* @__PURE__ */ f(l, {
		gap: "md",
		children: [/* @__PURE__ */ d(o, {
			as: "footer",
			bg: "bg",
			h: "xl",
			display: "flex",
			alignItems: "center",
			justifyContent: "flex-end",
			px: "sm",
			children: /* @__PURE__ */ d(p, { connected: e })
		}), /* @__PURE__ */ d(s, {
			size: "sm",
			onClick: () => t(!e),
			children: e ? "Disconnect" : "Reconnect"
		})]
	});
}, h = {
	title: "Sync/Backend connection status",
	component: p,
	args: { connected: !1 },
	parameters: { layout: "padded" }
}, g = { play: async ({ canvasElement: e }) => {
	let t = r(e).getByRole("status");
	await i(t).toBeVisible(), await i(t).not.toHaveTextContent(/^$/);
} }, _ = {
	args: { connected: !0 },
	play: async ({ canvasElement: e }) => {
		let t = r(e).getByRole("status");
		await i(t).toHaveTextContent(/^$/), await n.tab(), await i(t).toHaveFocus();
		let a = await r(document.body).findByRole("tooltip");
		await i(a).toHaveTextContent(t.getAttribute("aria-label") ?? "");
	}
}, v = {
	render: () => /* @__PURE__ */ d(m, {}),
	play: async ({ canvasElement: e }) => {
		let t = r(e);
		await i(t.getByRole("status")).toBeVisible(), await n.click(t.getByRole("button", { name: "Reconnect" })), await i(t.getByRole("status")).toBeVisible(), await i(t.getByRole("status")).toHaveTextContent(/^$/), await i(t.queryByRole("status", { name: /connection lost/i })).not.toBeInTheDocument();
	}
};
export { _ as Connected, g as Disconnected, v as Recovered, h as default };
