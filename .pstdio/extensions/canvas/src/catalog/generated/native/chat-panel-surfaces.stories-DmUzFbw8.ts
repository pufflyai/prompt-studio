// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, h as t, p as n, r } from "./test-whhQHjQi.ts";
import { t as i } from "./arrow-up-right-CUuzCgQb.ts";
import { t as a } from "./git-branch-BjWwGBn9.ts";
import { t as o } from "./chat-panel-DXY6mCVA.ts";
import { t as s } from "./workspace-hub-BZBU-L1T.ts";
import { Box as c, Button as l, IconButton as u, Stack as d, Tabs as f } from "@chakra-ui/react";
import { jsx as p, jsxs as m } from "react/jsx-runtime";
// packages/ui/src/components/chat-ui/components/chat-panel-surfaces.stories.tsx
var h = /* @__PURE__ */ m(l, {
	size: "xs",
	variant: "ghost",
	children: [/* @__PURE__ */ p(a, {}), "release-notes"]
}), g = {
	title: "Patterns/Chat/Composer Surfaces",
	component: o,
	parameters: { layout: "padded" },
	args: {
		messages: [],
		emptyStateTitle: "Prepare release notes",
		emptyStateDescription: "Review the workspace changes and start a conversation.",
		chatInputPlaceholder: "Describe the release...",
		chatInputDefaultValue: "Summarize the changes in this workspace.",
		workspaceHub: /* @__PURE__ */ p(s, {
			workspaceControl: h,
			additions: 24,
			deletions: 6,
			action: /* @__PURE__ */ p(u, {
				size: "xs",
				variant: "ghost",
				"aria-label": "Open workspace",
				children: /* @__PURE__ */ p(i, {})
			})
		}),
		onSubmitMessage: e()
	},
	render: (e) => /* @__PURE__ */ m(d, {
		maxW: "chat-content",
		gap: "sm",
		children: [/* @__PURE__ */ p(f.Root, {
			defaultValue: "conversation",
			size: "sm",
			children: /* @__PURE__ */ m(f.List, { children: [
				/* @__PURE__ */ p(f.Trigger, {
					value: "conversation",
					children: "Conversation"
				}),
				/* @__PURE__ */ p(f.Trigger, {
					value: "files",
					children: "Files"
				}),
				/* @__PURE__ */ p(f.Trigger, {
					value: "archived",
					disabled: !0,
					children: "Archived"
				})
			] })
		}), /* @__PURE__ */ p(c, {
			h: "lg",
			children: /* @__PURE__ */ p(o, { ...e })
		})]
	}),
	play: async ({ canvasElement: e, args: i }) => {
		let a = t(e), o = a.getByTestId("content-editable"), s = o.closest(".ps-chat-composer__input");
		if (!s) throw Error("Chat input is missing");
		let c = a.getAllByRole("tab");
		await n.click(c[0]), await r(s).toHaveStyle({
			borderWidth: "0px",
			outlineStyle: "none"
		});
		for (let e of c) await r(e).toHaveStyle({ borderWidth: "0px" });
		let l = e.querySelector(".ps-chat-composer__workspace");
		if (i.workspaceHub && (await r(l).toHaveStyle({
			borderWidth: "0px",
			rowGap: "0px"
		}), await r(getComputedStyle(l).backgroundColor).toBe(getComputedStyle(c[0]).backgroundColor)), i.inputDisabled) return;
		let u = s.getBoundingClientRect();
		await n.click(o), await r(s).toHaveStyle({
			outlineStyle: "solid",
			outlineWidth: "1px",
			outlineOffset: "-1px"
		});
		let d = s.getBoundingClientRect();
		await r([
			d.width,
			d.height,
			d.bottom
		]).toEqual([
			u.width,
			u.height,
			u.bottom
		]), i.chatInputAutoFocus || (await n.click(c[0]), await r(s).toHaveStyle({ outlineStyle: "none" }));
	}
}, _ = { globals: { theme: "pstdio-light" } }, v = { globals: { theme: "pstdio-dark" } }, y = { args: { workspaceHub: void 0 } }, b = {
	args: { chatInputAutoFocus: !0 },
	parameters: { docs: { description: { story: "Focus inside the input highlights its edge without changing its size." } } }
}, x = {
	...b,
	globals: { theme: "pstdio-dark" }
}, S = {
	...b,
	args: {
		chatInputAutoFocus: !0,
		workspaceHub: void 0
	}
}, C = { args: {
	inputDisabled: !0,
	workspaceHub: /* @__PURE__ */ p(s, {
		workspaceControl: h,
		additions: 0,
		deletions: 0,
		status: "loading",
		statusLabel: "Setting up workspace"
	})
} }, w = { args: { workspaceHub: /* @__PURE__ */ p(s, {
	workspaceControl: h,
	additions: 0,
	deletions: 0,
	status: "error",
	statusLabel: "Workspace setup failed"
}) } };
export { v as Dark, b as Focused, x as FocusedDark, S as FocusedWithoutWorkspace, _ as Light, C as SettingUp, w as SetupFailed, y as WithoutWorkspace, g as default };
