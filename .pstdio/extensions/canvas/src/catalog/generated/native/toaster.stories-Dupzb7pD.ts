// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, m as t, p as n, r } from "./test-whhQHjQi.ts";
import { n as i, t as a } from "./toaster-CwgolY6M.ts";
import { t as o } from "./window-title-bar-BQdVajcZ.ts";
import { useState as s } from "react";
import { Box as c, Button as l, HStack as u, Stack as d, Text as f } from "@chakra-ui/react";
import { jsx as p, jsxs as m } from "react/jsx-runtime";
// packages/ui/src/components/primitives/toaster.stories.tsx
var h = "#1 [internal] load local bake definitions\n#15 exporting to image\nImage pstdio-ps-46-a2-prompt-studio Built\nContainer pstdio-ps-46-a2-prompt-studio-1 Creating\nError response from daemon: invalid volume specification:\n'/host_mnt/Users/au-re/.pstdio-dev/workspaces/PS-46_A2/infra/local:.:rw'\ninvalid mount config for type \"bind\": invalid mount path: '.'\nmount path must be absolute", g = {
	title: "Components/Feedback/Toaster",
	component: a,
	decorators: [(e) => /* @__PURE__ */ p(c, {
		minH: "320px",
		padding: "sm",
		background: "bg",
		children: /* @__PURE__ */ p(e, {})
	})]
}, _ = { render: () => /* @__PURE__ */ m(d, {
	gap: "md",
	children: [
		/* @__PURE__ */ p(f, {
			textStyle: "paragraph/S/regular",
			color: "fg.muted",
			children: "Trigger a toast to preview styling and placement."
		}),
		/* @__PURE__ */ m(u, {
			gap: "sm",
			flexWrap: "wrap",
			children: [
				/* @__PURE__ */ p(l, {
					size: "sm",
					onClick: () => {
						i.create({
							type: "success",
							title: "Pipeline saved",
							description: "The latest version is ready to run."
						});
					},
					children: "Success"
				}),
				/* @__PURE__ */ p(l, {
					size: "sm",
					variant: "outline",
					onClick: () => {
						i.create({
							type: "warning",
							title: "Missing source files",
							description: "Add at least one file before starting the job."
						});
					},
					children: "Warning"
				}),
				/* @__PURE__ */ p(l, {
					size: "sm",
					variant: "destructive",
					onClick: () => {
						i.create({
							type: "error",
							title: "Upload failed",
							description: "We could not reach the storage bucket."
						});
					},
					children: "Error"
				}),
				/* @__PURE__ */ p(l, {
					size: "sm",
					variant: "ghost",
					onClick: () => {
						i.create({
							type: "loading",
							title: "Preparing export",
							description: "Generating the bundle for this pipeline."
						});
					},
					children: "Loading"
				}),
				/* @__PURE__ */ p(l, {
					size: "sm",
					variant: "outline",
					onClick: () => {
						i.create({
							type: "error",
							title: "Run project failed",
							description: h
						});
					},
					children: "Long error"
				})
			]
		}),
		/* @__PURE__ */ p(a, {})
	]
}) }, v = () => {
	let [e, t] = s(!1);
	return /* @__PURE__ */ m(c, {
		"data-window-full-screen": "",
		position: "fixed",
		inset: "0",
		children: [
			/* @__PURE__ */ p(o, { platform: "darwin" }),
			/* @__PURE__ */ m(d, {
				padding: "sm",
				gap: "sm",
				alignItems: "start",
				children: [
					/* @__PURE__ */ p(f, {
						textStyle: "paragraph/S/regular",
						children: "Toast controls stay below the desktop title bar."
					}),
					/* @__PURE__ */ p(l, {
						size: "sm",
						onClick: () => i.create({
							type: "success",
							title: "Workspace ready",
							duration: Infinity,
							action: {
								label: "Open workspace",
								onClick: () => t(!0)
							}
						}),
						children: "Show toast"
					}),
					e && /* @__PURE__ */ p(f, { children: "Workspace opened" })
				]
			}),
			/* @__PURE__ */ p(a, {})
		]
	});
}, y = {
	tags: ["!manifest"],
	parameters: { layout: "fullscreen" },
	render: () => /* @__PURE__ */ p(v, {}),
	play: async ({ canvasElement: i }) => {
		let a = e(i), o = e(i.ownerDocument.body);
		await n.click(a.getByRole("button", { name: "Show toast" }));
		let s = await o.findByRole("button", { name: "Dismiss notification" }), c = i.querySelector("[data-window-title-bar]");
		await t(() => r(s.getBoundingClientRect().top).toBeGreaterThanOrEqual(c.getBoundingClientRect().bottom)), await n.click(await o.findByRole("button", { name: "Open workspace" })), await r(a.getByText("Workspace opened")).toBeVisible(), await t(() => r(o.queryByText("Workspace ready")).not.toBeInTheDocument()), await n.click(a.getByRole("button", { name: "Show toast" })), await n.click(await o.findByRole("button", { name: "Dismiss notification" })), await t(() => r(o.queryByText("Workspace ready")).not.toBeInTheDocument());
	}
};
export { _ as Variants, y as WithDesktopTitleBar, g as default };
