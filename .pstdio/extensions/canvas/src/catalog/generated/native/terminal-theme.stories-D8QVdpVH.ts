// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, o as t, s as n, t as r } from "./test-CYwQ_LKY.ts";
import { t as i } from "./workbench-BbqJVWhj.ts";
import { t as a } from "./workbench-theme-provider-CQSyY8qK.ts";
import { t as o } from "./host-terminal-story-CcKW5EdM.ts";
import { Box as s, Button as c, HStack as l, Stack as u } from "@chakra-ui/react";
import { defaultThemePreferences as d, useThemePreference as f } from "@pstdio/ui";
import { jsx as p, jsxs as m } from "react/jsx-runtime";
// packages/pstdio-workbench/src/examples/terminal-theme.stories.tsx
var h = o(), g = [{
	id: "terminal-story.kiln",
	mode: "dark",
	tokens: {
		"colors.bg": "#25272b",
		"colors.fg": "#e7e9ec"
	}
}, {
	id: "terminal-story.dark-paper",
	mode: "light",
	tokens: {
		"colors.bg": "#fdf6e3",
		"colors.fg": "#657b83",
		"colors.vscode.terminal.background": "#eee8d5",
		"colors.vscode.terminal.foreground": "#586e75",
		"colors.vscode.terminal.ansiRed": "#dc322f"
	}
}], _ = () => {
	let { setThemePreference: e, previewThemePreference: t } = f();
	return /* @__PURE__ */ m(l, {
		p: "xs",
		children: [
			/* @__PURE__ */ p(c, {
				size: "xs",
				onClick: () => e(g[1].id),
				children: "Paper"
			}),
			/* @__PURE__ */ p(c, {
				size: "xs",
				onClick: () => t(g[0].id),
				children: "Preview Kiln"
			}),
			/* @__PURE__ */ p(c, {
				size: "xs",
				onClick: () => t(null),
				children: "End preview"
			}),
			/* @__PURE__ */ p(c, {
				size: "xs",
				onClick: () => e("pstdio-dark"),
				children: "Default dark"
			})
		]
	});
}, v = {
	title: "pstdio-workbench/Reference/Host terminal themes",
	parameters: {
		layout: "fullscreen",
		controls: { disable: !0 }
	},
	tags: ["!manifest"],
	render: () => /* @__PURE__ */ p(a, {
		initialThemePreference: g[0].id,
		themePreferences: [...d, ...g],
		children: /* @__PURE__ */ m(u, {
			h: "100dvh",
			minH: "0",
			gap: "0",
			children: [/* @__PURE__ */ p(_, {}), /* @__PURE__ */ p(s, {
				flex: "1",
				minH: "0",
				children: /* @__PURE__ */ p(i, { workbench: h })
			})]
		})
	})
}, y = { play: async ({ canvasElement: i }) => {
	let a = n(i);
	await e.click(await a.findByRole("tab", { name: "Terminal 1" }));
	let o = await t(() => {
		let e = i.querySelector(".xterm-viewport");
		return r(e).toBeVisible(), e;
	}), s = i.querySelector(".xterm-helper-textarea"), c = () => getComputedStyle(o).backgroundColor;
	await t(() => r(c()).toBe("rgb(37, 39, 43)")), await e.click(a.getByRole("button", { name: "Paper" })), await t(() => r(c()).toBe("rgb(238, 232, 213)")), await e.click(a.getByRole("button", { name: "Preview Kiln" })), await t(() => r(c()).toBe("rgb(37, 39, 43)")), await e.click(a.getByRole("button", { name: "End preview" })), await t(() => r(c()).toBe("rgb(238, 232, 213)")), await e.click(a.getByRole("button", { name: "Default dark" })), await t(() => r(c()).toBe("rgb(10, 10, 10)")), await r(i.querySelector(".xterm-helper-textarea")).toBe(s), await r(a.getByText("workbench host terminal (scripted)", { exact: !1 })).toBeVisible();
} };
export { y as ThemeChangesKeepSession, v as default };
