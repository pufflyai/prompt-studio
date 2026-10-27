// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./workbench-core-kaLFKJEn.ts";
import { i as t, r as n, t as r } from "./terminal-module-DSNuh2gh.ts";
import { Box as i, Button as a, Stack as o, Text as s } from "@chakra-ui/react";
import { jsx as c, jsxs as l } from "react/jsx-runtime";
import { createScriptedTerminalBridge as u } from "@pstdio/ui/terminal";
// packages/pstdio-workbench/src/examples/host-terminal-story.tsx
var d = "host-terminal-story.notes", f = "host-terminal-story.launcher", p = () => ({
	id: "host-terminal-story",
	activate(e) {
		let t = u({ initial: [{ data: "workbench host terminal (scripted)\r\n$ " }] });
		e.terminal.setSessionOpener((e) => t.openSession(e));
		let p = n().activate(e), m = e.views.registerView({
			id: f,
			title: "Terminal launcher",
			body: {
				kind: "react",
				render: ({ workbench: e }) => /* @__PURE__ */ l(o, {
					h: "full",
					gap: "md",
					p: "lg",
					bg: "bg",
					children: [
						/* @__PURE__ */ l(o, {
							gap: "xs",
							children: [/* @__PURE__ */ c(s, {
								textStyle: "heading/M/semibold",
								children: "Host terminals"
							}), /* @__PURE__ */ c(s, {
								color: "fg.muted",
								children: "Each open creates a separate terminal resource and a new tab in the Secondary panel."
							})]
						}),
						/* @__PURE__ */ c(a, {
							alignSelf: "flex-start",
							onClick: () => void e.commands.executeCommand(r),
							children: "Open another terminal"
						}),
						/* @__PURE__ */ c(s, {
							color: "fg.muted",
							textStyle: "paragraph/XS/regular",
							children: "You can also use the + menu in the Secondary panel."
						})
					]
				})
			}
		}), h = e.shellPlacements.registerPlacement({
			id: f,
			item: {
				kind: "view",
				presence: "fixed",
				view: {
					kind: "view",
					id: f
				}
			},
			region: "main"
		}), g = e.views.registerView({
			id: d,
			title: "notes.md",
			body: {
				kind: "react",
				render: () => /* @__PURE__ */ l(i, {
					h: "full",
					w: "full",
					p: "md",
					bg: "bg",
					color: "fg",
					children: [/* @__PURE__ */ c(s, {
						textStyle: "label/S/medium",
						children: "notes.md"
					}), /* @__PURE__ */ l(s, {
						mt: "sm",
						textStyle: "paragraph/S/regular",
						color: "fg.muted",
						children: [
							"build: ready",
							/* @__PURE__ */ c("br", {}),
							"owner: workbench"
						]
					})]
				})
			}
		}), _ = e.shellPlacements.registerPlacement({
			id: d,
			item: {
				kind: "view",
				presence: "closed",
				view: {
					kind: "view",
					id: d
				}
			},
			region: "secondary"
		});
		return [
			...p ? [p].flat() : [],
			m,
			h,
			g,
			_
		];
	}
}), m = (t) => {
	let n = e({ layoutPersistence: t });
	return n.registerModule(p()), n;
}, h = () => {
	let e = m();
	return t(e), e.shellPlacements.openPlacement({ placementId: d }), e;
};
export { h as t };
