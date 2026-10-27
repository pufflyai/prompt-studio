// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./project-setup-status-CO0VswgG.ts";
import { t } from "./resources-CR_Z7fRd.ts";
import { n, r, t as i } from "./start-recent-list-WovIsFtk.ts";
import { t as a } from "./start-harness-status-UhZXNGRg.ts";
import { Box as o, Stack as s, Text as c } from "@chakra-ui/react";
import { jsx as l, jsxs as u } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/modules/start/components/start-widget.stories.tsx
var d = (e, n, r, i, a) => ({
	id: e,
	title: n,
	icon: i,
	updatedAt: a,
	resource: t(r.toLowerCase(), e, n, i, "project-1")
}), f = [
	d("session-1", "Make the weekly report easier to scan", "Session", "message-circle", "2026-06-16T14:24:00.000Z"),
	d("ticket-1", "PS-231 Persistent project tabs", "Ticket", "component", "2026-06-16T11:02:00.000Z"),
	d("artifact-1", "Weekly activity summary", "Artifact", "file-code", "2026-06-15T09:10:00.000Z"),
	d("workspace-1", "PS-231_A1", "Workspace", "computer", "2026-06-14T17:45:00.000Z")
], p = [
	{
		id: "new-conversation",
		label: "New conversation",
		icon: "message-square",
		run: () => void 0
	},
	{
		id: "open-tool",
		label: "Open a tool",
		icon: "panels-top-left",
		run: () => void 0
	},
	{
		id: "browse-extensions",
		label: "Browse extensions",
		icon: "blocks",
		run: () => void 0
	}
], m = "default extensions: Failed to clone https://github.com/pufflyai/prompt-studio.git at pstdio@0.40.0: spawn git ENOENT", h = {
	title: "Start/StartPage",
	component: (t) => {
		let { setupError: d, harnesses: m } = t;
		return /* @__PURE__ */ u(s, {
			w: "full",
			maxW: "52rem",
			pt: "4xl",
			pb: "3xl",
			gap: "3xl",
			children: [
				/* @__PURE__ */ u(s, {
					gap: "xs",
					minW: "0",
					children: [/* @__PURE__ */ l(c, {
						textStyle: "heading/M",
						children: "Prompt Studio"
					}), /* @__PURE__ */ l(c, {
						textStyle: "paragraph/M/regular",
						color: "fg.muted",
						children: "Project home"
					})]
				}),
				d && /* @__PURE__ */ l(e, {
					error: d,
					onRetry: () => void 0
				}),
				/* @__PURE__ */ l(r, {}),
				!d && m && /* @__PURE__ */ l(a, {
					agents: m,
					onReviewExtensions: () => void 0,
					onCheckAgain: () => void 0
				}),
				/* @__PURE__ */ u(s, {
					direction: {
						base: "column",
						md: "row"
					},
					gap: {
						base: "3xl",
						md: "4xl"
					},
					align: "flex-start",
					minW: "0",
					children: [/* @__PURE__ */ l(o, {
						flex: "1",
						minW: "0",
						w: "full",
						children: /* @__PURE__ */ l(n, { actions: p })
					}), /* @__PURE__ */ l(o, {
						flex: "1",
						minW: "0",
						w: "full",
						children: /* @__PURE__ */ l(i, {
							resources: f,
							onOpen: () => void 0
						})
					})]
				})
			]
		});
	},
	parameters: { layout: "padded" }
}, g = {}, _ = { args: { harnesses: [] } }, v = { args: {
	setupError: m,
	harnesses: []
} }, y = { render: () => /* @__PURE__ */ u(s, {
	w: "full",
	maxW: "52rem",
	gap: "3xl",
	children: [/* @__PURE__ */ l(r, {}), /* @__PURE__ */ u(s, {
		direction: {
			base: "column",
			md: "row"
		},
		gap: {
			base: "3xl",
			md: "4xl"
		},
		align: "flex-start",
		minW: "0",
		children: [/* @__PURE__ */ l(o, {
			flex: "1",
			minW: "0",
			w: "full",
			children: /* @__PURE__ */ l(n, { actions: p })
		}), /* @__PURE__ */ l(o, {
			flex: "1",
			minW: "0",
			w: "full",
			children: /* @__PURE__ */ l(i, {
				resources: [],
				onOpen: () => void 0
			})
		})]
	})]
}) };
export { g as Default, _ as NoAgentAvailable, y as NoRecentResources, v as SetupDidNotFinish, h as default };
