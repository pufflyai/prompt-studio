// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
// packages/ui/src/utils/apply-theme-preference.ts
var e = [{
	id: "pstdio-light",
	mode: "light"
}, {
	id: "pstdio-dark",
	mode: "dark"
}], t = (t, n = e) => n.find((e) => e.id === t)?.mode ?? "light", n = (e) => `theme-${e}`, r = (e, r = t(e)) => [r, n(e)], i = (e) => `--chakra-${e.replaceAll(".", "-")}`;
`${i("colors.fg")}${i("colors.bg")}`;
export { r as n, t as r, e as t };
