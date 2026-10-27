// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, m as t, p as n, r } from "./test-whhQHjQi.ts";
import { t as i } from "./param-editor-label-BDQjmLHj.ts";
import { CloseButton as a, Dialog as o } from "@chakra-ui/react";
import { jsx as s, jsxs as c } from "react/jsx-runtime";
// packages/ui/src/components/param-editor/param-editor-label.stories.tsx
var l = {
	title: "Patterns/Param Editor/Label",
	component: i,
	args: {
		name: "Workspace type",
		description: "Create an isolated branch. Git review and merge cover the entire repository, including paths outside the project folder."
	}
}, u = { play: async ({ canvasElement: i }) => {
	let a = n.setup(), o = e(i), s = o.getByRole("img", { name: "About Workspace type" });
	await a.tab(), await t(() => r(o.getByRole("tooltip")).toBeVisible()), await a.keyboard("{Escape}"), await t(() => r(o.queryByRole("tooltip")).not.toBeInTheDocument()), await r(s).toHaveFocus();
} }, d = { args: { compact: !0 } }, f = { args: { description: void 0 } }, p = {
	decorators: [(e) => /* @__PURE__ */ c(o.Root, {
		defaultOpen: !0,
		size: "sm",
		scrollBehavior: "inside",
		initialFocusEl: () => document.querySelector("[aria-label=\"Close workspace dialog\"]"),
		children: [/* @__PURE__ */ s(o.Backdrop, {}), /* @__PURE__ */ s(o.Positioner, { children: /* @__PURE__ */ c(o.Content, { children: [
			/* @__PURE__ */ s(o.Header, { children: /* @__PURE__ */ s(o.Title, { children: "Create workspace" }) }),
			/* @__PURE__ */ s(o.Body, { children: /* @__PURE__ */ s(e, {}) }),
			/* @__PURE__ */ s(o.CloseTrigger, {
				asChild: !0,
				children: /* @__PURE__ */ s(a, {
					size: "sm",
					"aria-label": "Close workspace dialog"
				})
			})
		] }) })]
	})],
	play: async ({ canvasElement: i }) => {
		let a = n.setup(), o = e(i.ownerDocument.body), s = o.getByRole("img", { name: "About Workspace type" });
		await t(() => r(o.getByRole("dialog", { name: "Create workspace" })).toHaveStyle({ opacity: "1" })), o.getByRole("button", { name: "Close workspace dialog" }).focus(), await t(() => r(o.queryByRole("tooltip")).not.toBeInTheDocument()), await a.hover(s), await t(() => r(o.getByRole("tooltip")).toBeVisible()), await a.hover(o.getByRole("heading", { name: "Create workspace" })), await t(() => r(o.queryByRole("tooltip")).not.toBeInTheDocument()), await a.tab(), await t(() => {
			r(o.getByRole("tooltip")).toBeVisible(), r(s).toHaveFocus();
		}), o.getByRole("button", { name: "Close workspace dialog" }).focus(), await t(() => r(o.queryByRole("tooltip")).not.toBeInTheDocument()), await r(o.getByRole("dialog", { name: "Create workspace" })).toBeVisible();
	}
};
export { d as Compact, p as InformationInDialog, u as WithInformation, f as WithoutInformation, l as default };
