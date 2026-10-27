// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
// packages/pstdio-workbench/src/react/theme/workbench-theme-background.ts
var e = {
	sidenav: "var(--chakra-colors-bg-subtle)",
	main: "var(--chakra-colors-bg)",
	panel: "var(--chakra-colors-bg-panel)"
}, t = (e, t) => `var(--chakra-colors-vscode-${e.replaceAll(".", "-")}, ${t})`, n = {
	sidenav: t("sideBar.background", e.sidenav),
	main: t("editor.background", e.main),
	panel: t("panel.background", e.panel),
	widget: t("editorWidget.background", t("panel.background", e.panel))
}, r = {
	nav: n.main,
	activity: n.main,
	sidenav: n.sidenav,
	"main-header": n.main,
	"main-left-menu": n.panel,
	main: n.main,
	"main-right-menu": n.panel,
	"secondary-header": n.panel,
	"secondary-left-menu": n.panel,
	secondary: n.panel,
	"secondary-right-menu": n.panel,
	status: n.main,
	overlay: n.widget,
	"side-header": n.widget,
	"side-left-menu": n.widget,
	side: n.widget,
	"side-right-menu": n.widget
};
t("focusBorder", "var(--chakra-colors-color-palette-focus-ring)");
var i = n.widget, a = (e) => r[e];
export { n, i as r, a as t };
