// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
// node_modules/.bun/react-i18next@16.5.8+d976778d4c9f401e/node_modules/react-i18next/dist/es/unescape.js
var e = /&(?:amp|#38|lt|#60|gt|#62|apos|#39|quot|#34|nbsp|#160|copy|#169|reg|#174|hellip|#8230|#x2F|#47);/g, t = {
	"&amp;": "&",
	"&#38;": "&",
	"&lt;": "<",
	"&#60;": "<",
	"&gt;": ">",
	"&#62;": ">",
	"&apos;": "'",
	"&#39;": "'",
	"&quot;": "\"",
	"&#34;": "\"",
	"&nbsp;": " ",
	"&#160;": " ",
	"&copy;": "©",
	"&#169;": "©",
	"&reg;": "®",
	"&#174;": "®",
	"&hellip;": "…",
	"&#8230;": "…",
	"&#x2F;": "/",
	"&#47;": "/"
}, n = (e) => t[e], r = {
	bindI18n: "languageChanged",
	bindI18nStore: "",
	transEmptyNodeValue: "",
	transSupportBasicHtmlNodes: !0,
	transWrapTextNodes: "",
	transKeepBasicHtmlNodesFor: [
		"br",
		"strong",
		"i",
		"p"
	],
	useSuspense: !0,
	unescape: (t) => t.replace(e, n),
	transDefaultProps: void 0
}, i = (e = {}) => {
	r = {
		...r,
		...e
	};
}, a = () => r, o, s = (e) => {
	o = e;
}, c = () => o;
export { i, s as n, a as r, c as t };
