// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { i as e, n as t, t as n } from "./rolldown-runtime-CwxnZyOB.ts";
import { t as r } from "./message-square-C0JbtaT-.ts";
import "./default-DW7wlMJ9.ts";
import { S as i, d as a, i as o, t as s } from "./lib-B4PjEPpe.ts";
import { createContext as c, useContext as l, useEffect as u, useRef as d, useState as f } from "react";
import { Box as p, Button as m, Flex as ee, Icon as h, Stack as g, Text as _, chakra as v } from "@chakra-ui/react";
import { Fragment as y, jsx as b, jsxs as x } from "react/jsx-runtime";
import { QuestionPromptControls as te, useQuestionPromptState as ne } from "@pstdio/ui/chat-ui";
// node_modules/.bun/comma-separated-tokens@2.0.3/node_modules/comma-separated-tokens/index.js
function S(e, t) {
	let n = t || {};
	return (e[e.length - 1] === "" ? [...e, ""] : e).join((n.padRight ? " " : "") + "," + (n.padLeft === !1 ? "" : " ")).trim();
}
// node_modules/.bun/estree-util-is-identifier-name@3.0.0/node_modules/estree-util-is-identifier-name/lib/index.js
var C = /^[$_\p{ID_Start}][$_\u{200C}\u{200D}\p{ID_Continue}]*$/u, re = /^[$_\p{ID_Start}][-$_\u{200C}\u{200D}\p{ID_Continue}]*$/u, ie = {};
function ae(e, t) {
	return ((t || ie).jsx ? re : C).test(e);
}
// node_modules/.bun/hast-util-whitespace@3.0.0/node_modules/hast-util-whitespace/lib/index.js
var oe = /[ \t\n\f\r]/g;
function se(e) {
	return typeof e == "object" ? e.type === "text" && ce(e.value) : ce(e);
}
function ce(e) {
	return e.replace(oe, "") === "";
}
// node_modules/.bun/property-information@7.1.0/node_modules/property-information/lib/util/schema.js
var w = class {
	constructor(e, t, n) {
		this.normal = t, this.property = e, n && (this.space = n);
	}
};
w.prototype.normal = {}, w.prototype.property = {}, w.prototype.space = void 0;
// node_modules/.bun/property-information@7.1.0/node_modules/property-information/lib/util/merge.js
function le(e, t) {
	let n = {}, r = {};
	for (let t of e) Object.assign(n, t.property), Object.assign(r, t.normal);
	return new w(n, r, t);
}
// node_modules/.bun/property-information@7.1.0/node_modules/property-information/lib/normalize.js
function ue(e) {
	return e.toLowerCase();
}
// node_modules/.bun/property-information@7.1.0/node_modules/property-information/lib/util/info.js
var T = class {
	constructor(e, t) {
		this.attribute = t, this.property = e;
	}
};
T.prototype.attribute = "", T.prototype.booleanish = !1, T.prototype.boolean = !1, T.prototype.commaOrSpaceSeparated = !1, T.prototype.commaSeparated = !1, T.prototype.defined = !1, T.prototype.mustUseProperty = !1, T.prototype.number = !1, T.prototype.overloadedBoolean = !1, T.prototype.property = "", T.prototype.spaceSeparated = !1, T.prototype.space = void 0;
// node_modules/.bun/property-information@7.1.0/node_modules/property-information/lib/util/types.js
var E = /* @__PURE__ */ t({
	boolean: () => D,
	booleanish: () => O,
	commaOrSpaceSeparated: () => M,
	commaSeparated: () => j,
	number: () => k,
	overloadedBoolean: () => fe,
	spaceSeparated: () => A
}), de = 0, D = N(), O = N(), fe = N(), k = N(), A = N(), j = N(), M = N();
function N() {
	return 2 ** ++de;
}
// node_modules/.bun/property-information@7.1.0/node_modules/property-information/lib/util/defined-info.js
var pe = Object.keys(E), me = class extends T {
	constructor(e, t, n, r) {
		let i = -1;
		if (super(e, t), he(this, "space", r), typeof n == "number") for (; ++i < pe.length;) {
			let e = pe[i];
			he(this, pe[i], (n & E[e]) === E[e]);
		}
	}
};
me.prototype.defined = !0;
function he(e, t, n) {
	n && (e[t] = n);
}
// node_modules/.bun/property-information@7.1.0/node_modules/property-information/lib/util/create.js
function P(e) {
	let t = {}, n = {};
	for (let [r, i] of Object.entries(e.properties)) {
		let a = new me(r, e.transform(e.attributes || {}, r), i, e.space);
		e.mustUseProperty && e.mustUseProperty.includes(r) && (a.mustUseProperty = !0), t[r] = a, n[ue(r)] = r, n[ue(a.attribute)] = r;
	}
	return new w(t, n, e.space);
}
// node_modules/.bun/property-information@7.1.0/node_modules/property-information/lib/aria.js
var ge = P({
	properties: {
		ariaActiveDescendant: null,
		ariaAtomic: O,
		ariaAutoComplete: null,
		ariaBusy: O,
		ariaChecked: O,
		ariaColCount: k,
		ariaColIndex: k,
		ariaColSpan: k,
		ariaControls: A,
		ariaCurrent: null,
		ariaDescribedBy: A,
		ariaDetails: null,
		ariaDisabled: O,
		ariaDropEffect: A,
		ariaErrorMessage: null,
		ariaExpanded: O,
		ariaFlowTo: A,
		ariaGrabbed: O,
		ariaHasPopup: null,
		ariaHidden: O,
		ariaInvalid: null,
		ariaKeyShortcuts: null,
		ariaLabel: null,
		ariaLabelledBy: A,
		ariaLevel: k,
		ariaLive: null,
		ariaModal: O,
		ariaMultiLine: O,
		ariaMultiSelectable: O,
		ariaOrientation: null,
		ariaOwns: A,
		ariaPlaceholder: null,
		ariaPosInSet: k,
		ariaPressed: O,
		ariaReadOnly: O,
		ariaRelevant: null,
		ariaRequired: O,
		ariaRoleDescription: A,
		ariaRowCount: k,
		ariaRowIndex: k,
		ariaRowSpan: k,
		ariaSelected: O,
		ariaSetSize: k,
		ariaSort: null,
		ariaValueMax: k,
		ariaValueMin: k,
		ariaValueNow: k,
		ariaValueText: null,
		role: null
	},
	transform(e, t) {
		return t === "role" ? t : "aria-" + t.slice(4).toLowerCase();
	}
});
// node_modules/.bun/property-information@7.1.0/node_modules/property-information/lib/util/case-sensitive-transform.js
function _e(e, t) {
	return t in e ? e[t] : t;
}
// node_modules/.bun/property-information@7.1.0/node_modules/property-information/lib/util/case-insensitive-transform.js
function ve(e, t) {
	return _e(e, t.toLowerCase());
}
// node_modules/.bun/property-information@7.1.0/node_modules/property-information/lib/html.js
var ye = P({
	attributes: {
		acceptcharset: "accept-charset",
		classname: "class",
		htmlfor: "for",
		httpequiv: "http-equiv"
	},
	mustUseProperty: [
		"checked",
		"multiple",
		"muted",
		"selected"
	],
	properties: {
		abbr: null,
		accept: j,
		acceptCharset: A,
		accessKey: A,
		action: null,
		allow: null,
		allowFullScreen: D,
		allowPaymentRequest: D,
		allowUserMedia: D,
		alt: null,
		as: null,
		async: D,
		autoCapitalize: null,
		autoComplete: A,
		autoFocus: D,
		autoPlay: D,
		blocking: A,
		capture: null,
		charSet: null,
		checked: D,
		cite: null,
		className: A,
		cols: k,
		colSpan: null,
		content: null,
		contentEditable: O,
		controls: D,
		controlsList: A,
		coords: k | j,
		crossOrigin: null,
		data: null,
		dateTime: null,
		decoding: null,
		default: D,
		defer: D,
		dir: null,
		dirName: null,
		disabled: D,
		download: fe,
		draggable: O,
		encType: null,
		enterKeyHint: null,
		fetchPriority: null,
		form: null,
		formAction: null,
		formEncType: null,
		formMethod: null,
		formNoValidate: D,
		formTarget: null,
		headers: A,
		height: k,
		hidden: fe,
		high: k,
		href: null,
		hrefLang: null,
		htmlFor: A,
		httpEquiv: A,
		id: null,
		imageSizes: null,
		imageSrcSet: null,
		inert: D,
		inputMode: null,
		integrity: null,
		is: null,
		isMap: D,
		itemId: null,
		itemProp: A,
		itemRef: A,
		itemScope: D,
		itemType: A,
		kind: null,
		label: null,
		lang: null,
		language: null,
		list: null,
		loading: null,
		loop: D,
		low: k,
		manifest: null,
		max: null,
		maxLength: k,
		media: null,
		method: null,
		min: null,
		minLength: k,
		multiple: D,
		muted: D,
		name: null,
		nonce: null,
		noModule: D,
		noValidate: D,
		onAbort: null,
		onAfterPrint: null,
		onAuxClick: null,
		onBeforeMatch: null,
		onBeforePrint: null,
		onBeforeToggle: null,
		onBeforeUnload: null,
		onBlur: null,
		onCancel: null,
		onCanPlay: null,
		onCanPlayThrough: null,
		onChange: null,
		onClick: null,
		onClose: null,
		onContextLost: null,
		onContextMenu: null,
		onContextRestored: null,
		onCopy: null,
		onCueChange: null,
		onCut: null,
		onDblClick: null,
		onDrag: null,
		onDragEnd: null,
		onDragEnter: null,
		onDragExit: null,
		onDragLeave: null,
		onDragOver: null,
		onDragStart: null,
		onDrop: null,
		onDurationChange: null,
		onEmptied: null,
		onEnded: null,
		onError: null,
		onFocus: null,
		onFormData: null,
		onHashChange: null,
		onInput: null,
		onInvalid: null,
		onKeyDown: null,
		onKeyPress: null,
		onKeyUp: null,
		onLanguageChange: null,
		onLoad: null,
		onLoadedData: null,
		onLoadedMetadata: null,
		onLoadEnd: null,
		onLoadStart: null,
		onMessage: null,
		onMessageError: null,
		onMouseDown: null,
		onMouseEnter: null,
		onMouseLeave: null,
		onMouseMove: null,
		onMouseOut: null,
		onMouseOver: null,
		onMouseUp: null,
		onOffline: null,
		onOnline: null,
		onPageHide: null,
		onPageShow: null,
		onPaste: null,
		onPause: null,
		onPlay: null,
		onPlaying: null,
		onPopState: null,
		onProgress: null,
		onRateChange: null,
		onRejectionHandled: null,
		onReset: null,
		onResize: null,
		onScroll: null,
		onScrollEnd: null,
		onSecurityPolicyViolation: null,
		onSeeked: null,
		onSeeking: null,
		onSelect: null,
		onSlotChange: null,
		onStalled: null,
		onStorage: null,
		onSubmit: null,
		onSuspend: null,
		onTimeUpdate: null,
		onToggle: null,
		onUnhandledRejection: null,
		onUnload: null,
		onVolumeChange: null,
		onWaiting: null,
		onWheel: null,
		open: D,
		optimum: k,
		pattern: null,
		ping: A,
		placeholder: null,
		playsInline: D,
		popover: null,
		popoverTarget: null,
		popoverTargetAction: null,
		poster: null,
		preload: null,
		readOnly: D,
		referrerPolicy: null,
		rel: A,
		required: D,
		reversed: D,
		rows: k,
		rowSpan: k,
		sandbox: A,
		scope: null,
		scoped: D,
		seamless: D,
		selected: D,
		shadowRootClonable: D,
		shadowRootDelegatesFocus: D,
		shadowRootMode: null,
		shape: null,
		size: k,
		sizes: null,
		slot: null,
		span: k,
		spellCheck: O,
		src: null,
		srcDoc: null,
		srcLang: null,
		srcSet: null,
		start: k,
		step: null,
		style: null,
		tabIndex: k,
		target: null,
		title: null,
		translate: null,
		type: null,
		typeMustMatch: D,
		useMap: null,
		value: O,
		width: k,
		wrap: null,
		writingSuggestions: null,
		align: null,
		aLink: null,
		archive: A,
		axis: null,
		background: null,
		bgColor: null,
		border: k,
		borderColor: null,
		bottomMargin: k,
		cellPadding: null,
		cellSpacing: null,
		char: null,
		charOff: null,
		classId: null,
		clear: null,
		code: null,
		codeBase: null,
		codeType: null,
		color: null,
		compact: D,
		declare: D,
		event: null,
		face: null,
		frame: null,
		frameBorder: null,
		hSpace: k,
		leftMargin: k,
		link: null,
		longDesc: null,
		lowSrc: null,
		marginHeight: k,
		marginWidth: k,
		noResize: D,
		noHref: D,
		noShade: D,
		noWrap: D,
		object: null,
		profile: null,
		prompt: null,
		rev: null,
		rightMargin: k,
		rules: null,
		scheme: null,
		scrolling: O,
		standby: null,
		summary: null,
		text: null,
		topMargin: k,
		valueType: null,
		version: null,
		vAlign: null,
		vLink: null,
		vSpace: k,
		allowTransparency: null,
		autoCorrect: null,
		autoSave: null,
		disablePictureInPicture: D,
		disableRemotePlayback: D,
		prefix: null,
		property: null,
		results: k,
		security: null,
		unselectable: null
	},
	space: "html",
	transform: ve
}), be = P({
	attributes: {
		accentHeight: "accent-height",
		alignmentBaseline: "alignment-baseline",
		arabicForm: "arabic-form",
		baselineShift: "baseline-shift",
		capHeight: "cap-height",
		className: "class",
		clipPath: "clip-path",
		clipRule: "clip-rule",
		colorInterpolation: "color-interpolation",
		colorInterpolationFilters: "color-interpolation-filters",
		colorProfile: "color-profile",
		colorRendering: "color-rendering",
		crossOrigin: "crossorigin",
		dataType: "datatype",
		dominantBaseline: "dominant-baseline",
		enableBackground: "enable-background",
		fillOpacity: "fill-opacity",
		fillRule: "fill-rule",
		floodColor: "flood-color",
		floodOpacity: "flood-opacity",
		fontFamily: "font-family",
		fontSize: "font-size",
		fontSizeAdjust: "font-size-adjust",
		fontStretch: "font-stretch",
		fontStyle: "font-style",
		fontVariant: "font-variant",
		fontWeight: "font-weight",
		glyphName: "glyph-name",
		glyphOrientationHorizontal: "glyph-orientation-horizontal",
		glyphOrientationVertical: "glyph-orientation-vertical",
		hrefLang: "hreflang",
		horizAdvX: "horiz-adv-x",
		horizOriginX: "horiz-origin-x",
		horizOriginY: "horiz-origin-y",
		imageRendering: "image-rendering",
		letterSpacing: "letter-spacing",
		lightingColor: "lighting-color",
		markerEnd: "marker-end",
		markerMid: "marker-mid",
		markerStart: "marker-start",
		navDown: "nav-down",
		navDownLeft: "nav-down-left",
		navDownRight: "nav-down-right",
		navLeft: "nav-left",
		navNext: "nav-next",
		navPrev: "nav-prev",
		navRight: "nav-right",
		navUp: "nav-up",
		navUpLeft: "nav-up-left",
		navUpRight: "nav-up-right",
		onAbort: "onabort",
		onActivate: "onactivate",
		onAfterPrint: "onafterprint",
		onBeforePrint: "onbeforeprint",
		onBegin: "onbegin",
		onCancel: "oncancel",
		onCanPlay: "oncanplay",
		onCanPlayThrough: "oncanplaythrough",
		onChange: "onchange",
		onClick: "onclick",
		onClose: "onclose",
		onCopy: "oncopy",
		onCueChange: "oncuechange",
		onCut: "oncut",
		onDblClick: "ondblclick",
		onDrag: "ondrag",
		onDragEnd: "ondragend",
		onDragEnter: "ondragenter",
		onDragExit: "ondragexit",
		onDragLeave: "ondragleave",
		onDragOver: "ondragover",
		onDragStart: "ondragstart",
		onDrop: "ondrop",
		onDurationChange: "ondurationchange",
		onEmptied: "onemptied",
		onEnd: "onend",
		onEnded: "onended",
		onError: "onerror",
		onFocus: "onfocus",
		onFocusIn: "onfocusin",
		onFocusOut: "onfocusout",
		onHashChange: "onhashchange",
		onInput: "oninput",
		onInvalid: "oninvalid",
		onKeyDown: "onkeydown",
		onKeyPress: "onkeypress",
		onKeyUp: "onkeyup",
		onLoad: "onload",
		onLoadedData: "onloadeddata",
		onLoadedMetadata: "onloadedmetadata",
		onLoadStart: "onloadstart",
		onMessage: "onmessage",
		onMouseDown: "onmousedown",
		onMouseEnter: "onmouseenter",
		onMouseLeave: "onmouseleave",
		onMouseMove: "onmousemove",
		onMouseOut: "onmouseout",
		onMouseOver: "onmouseover",
		onMouseUp: "onmouseup",
		onMouseWheel: "onmousewheel",
		onOffline: "onoffline",
		onOnline: "ononline",
		onPageHide: "onpagehide",
		onPageShow: "onpageshow",
		onPaste: "onpaste",
		onPause: "onpause",
		onPlay: "onplay",
		onPlaying: "onplaying",
		onPopState: "onpopstate",
		onProgress: "onprogress",
		onRateChange: "onratechange",
		onRepeat: "onrepeat",
		onReset: "onreset",
		onResize: "onresize",
		onScroll: "onscroll",
		onSeeked: "onseeked",
		onSeeking: "onseeking",
		onSelect: "onselect",
		onShow: "onshow",
		onStalled: "onstalled",
		onStorage: "onstorage",
		onSubmit: "onsubmit",
		onSuspend: "onsuspend",
		onTimeUpdate: "ontimeupdate",
		onToggle: "ontoggle",
		onUnload: "onunload",
		onVolumeChange: "onvolumechange",
		onWaiting: "onwaiting",
		onZoom: "onzoom",
		overlinePosition: "overline-position",
		overlineThickness: "overline-thickness",
		paintOrder: "paint-order",
		panose1: "panose-1",
		pointerEvents: "pointer-events",
		referrerPolicy: "referrerpolicy",
		renderingIntent: "rendering-intent",
		shapeRendering: "shape-rendering",
		stopColor: "stop-color",
		stopOpacity: "stop-opacity",
		strikethroughPosition: "strikethrough-position",
		strikethroughThickness: "strikethrough-thickness",
		strokeDashArray: "stroke-dasharray",
		strokeDashOffset: "stroke-dashoffset",
		strokeLineCap: "stroke-linecap",
		strokeLineJoin: "stroke-linejoin",
		strokeMiterLimit: "stroke-miterlimit",
		strokeOpacity: "stroke-opacity",
		strokeWidth: "stroke-width",
		tabIndex: "tabindex",
		textAnchor: "text-anchor",
		textDecoration: "text-decoration",
		textRendering: "text-rendering",
		transformOrigin: "transform-origin",
		typeOf: "typeof",
		underlinePosition: "underline-position",
		underlineThickness: "underline-thickness",
		unicodeBidi: "unicode-bidi",
		unicodeRange: "unicode-range",
		unitsPerEm: "units-per-em",
		vAlphabetic: "v-alphabetic",
		vHanging: "v-hanging",
		vIdeographic: "v-ideographic",
		vMathematical: "v-mathematical",
		vectorEffect: "vector-effect",
		vertAdvY: "vert-adv-y",
		vertOriginX: "vert-origin-x",
		vertOriginY: "vert-origin-y",
		wordSpacing: "word-spacing",
		writingMode: "writing-mode",
		xHeight: "x-height",
		playbackOrder: "playbackorder",
		timelineBegin: "timelinebegin"
	},
	properties: {
		about: M,
		accentHeight: k,
		accumulate: null,
		additive: null,
		alignmentBaseline: null,
		alphabetic: k,
		amplitude: k,
		arabicForm: null,
		ascent: k,
		attributeName: null,
		attributeType: null,
		azimuth: k,
		bandwidth: null,
		baselineShift: null,
		baseFrequency: null,
		baseProfile: null,
		bbox: null,
		begin: null,
		bias: k,
		by: null,
		calcMode: null,
		capHeight: k,
		className: A,
		clip: null,
		clipPath: null,
		clipPathUnits: null,
		clipRule: null,
		color: null,
		colorInterpolation: null,
		colorInterpolationFilters: null,
		colorProfile: null,
		colorRendering: null,
		content: null,
		contentScriptType: null,
		contentStyleType: null,
		crossOrigin: null,
		cursor: null,
		cx: null,
		cy: null,
		d: null,
		dataType: null,
		defaultAction: null,
		descent: k,
		diffuseConstant: k,
		direction: null,
		display: null,
		dur: null,
		divisor: k,
		dominantBaseline: null,
		download: D,
		dx: null,
		dy: null,
		edgeMode: null,
		editable: null,
		elevation: k,
		enableBackground: null,
		end: null,
		event: null,
		exponent: k,
		externalResourcesRequired: null,
		fill: null,
		fillOpacity: k,
		fillRule: null,
		filter: null,
		filterRes: null,
		filterUnits: null,
		floodColor: null,
		floodOpacity: null,
		focusable: null,
		focusHighlight: null,
		fontFamily: null,
		fontSize: null,
		fontSizeAdjust: null,
		fontStretch: null,
		fontStyle: null,
		fontVariant: null,
		fontWeight: null,
		format: null,
		fr: null,
		from: null,
		fx: null,
		fy: null,
		g1: j,
		g2: j,
		glyphName: j,
		glyphOrientationHorizontal: null,
		glyphOrientationVertical: null,
		glyphRef: null,
		gradientTransform: null,
		gradientUnits: null,
		handler: null,
		hanging: k,
		hatchContentUnits: null,
		hatchUnits: null,
		height: null,
		href: null,
		hrefLang: null,
		horizAdvX: k,
		horizOriginX: k,
		horizOriginY: k,
		id: null,
		ideographic: k,
		imageRendering: null,
		initialVisibility: null,
		in: null,
		in2: null,
		intercept: k,
		k,
		k1: k,
		k2: k,
		k3: k,
		k4: k,
		kernelMatrix: M,
		kernelUnitLength: null,
		keyPoints: null,
		keySplines: null,
		keyTimes: null,
		kerning: null,
		lang: null,
		lengthAdjust: null,
		letterSpacing: null,
		lightingColor: null,
		limitingConeAngle: k,
		local: null,
		markerEnd: null,
		markerMid: null,
		markerStart: null,
		markerHeight: null,
		markerUnits: null,
		markerWidth: null,
		mask: null,
		maskContentUnits: null,
		maskUnits: null,
		mathematical: null,
		max: null,
		media: null,
		mediaCharacterEncoding: null,
		mediaContentEncodings: null,
		mediaSize: k,
		mediaTime: null,
		method: null,
		min: null,
		mode: null,
		name: null,
		navDown: null,
		navDownLeft: null,
		navDownRight: null,
		navLeft: null,
		navNext: null,
		navPrev: null,
		navRight: null,
		navUp: null,
		navUpLeft: null,
		navUpRight: null,
		numOctaves: null,
		observer: null,
		offset: null,
		onAbort: null,
		onActivate: null,
		onAfterPrint: null,
		onBeforePrint: null,
		onBegin: null,
		onCancel: null,
		onCanPlay: null,
		onCanPlayThrough: null,
		onChange: null,
		onClick: null,
		onClose: null,
		onCopy: null,
		onCueChange: null,
		onCut: null,
		onDblClick: null,
		onDrag: null,
		onDragEnd: null,
		onDragEnter: null,
		onDragExit: null,
		onDragLeave: null,
		onDragOver: null,
		onDragStart: null,
		onDrop: null,
		onDurationChange: null,
		onEmptied: null,
		onEnd: null,
		onEnded: null,
		onError: null,
		onFocus: null,
		onFocusIn: null,
		onFocusOut: null,
		onHashChange: null,
		onInput: null,
		onInvalid: null,
		onKeyDown: null,
		onKeyPress: null,
		onKeyUp: null,
		onLoad: null,
		onLoadedData: null,
		onLoadedMetadata: null,
		onLoadStart: null,
		onMessage: null,
		onMouseDown: null,
		onMouseEnter: null,
		onMouseLeave: null,
		onMouseMove: null,
		onMouseOut: null,
		onMouseOver: null,
		onMouseUp: null,
		onMouseWheel: null,
		onOffline: null,
		onOnline: null,
		onPageHide: null,
		onPageShow: null,
		onPaste: null,
		onPause: null,
		onPlay: null,
		onPlaying: null,
		onPopState: null,
		onProgress: null,
		onRateChange: null,
		onRepeat: null,
		onReset: null,
		onResize: null,
		onScroll: null,
		onSeeked: null,
		onSeeking: null,
		onSelect: null,
		onShow: null,
		onStalled: null,
		onStorage: null,
		onSubmit: null,
		onSuspend: null,
		onTimeUpdate: null,
		onToggle: null,
		onUnload: null,
		onVolumeChange: null,
		onWaiting: null,
		onZoom: null,
		opacity: null,
		operator: null,
		order: null,
		orient: null,
		orientation: null,
		origin: null,
		overflow: null,
		overlay: null,
		overlinePosition: k,
		overlineThickness: k,
		paintOrder: null,
		panose1: null,
		path: null,
		pathLength: k,
		patternContentUnits: null,
		patternTransform: null,
		patternUnits: null,
		phase: null,
		ping: A,
		pitch: null,
		playbackOrder: null,
		pointerEvents: null,
		points: null,
		pointsAtX: k,
		pointsAtY: k,
		pointsAtZ: k,
		preserveAlpha: null,
		preserveAspectRatio: null,
		primitiveUnits: null,
		propagate: null,
		property: M,
		r: null,
		radius: null,
		referrerPolicy: null,
		refX: null,
		refY: null,
		rel: M,
		rev: M,
		renderingIntent: null,
		repeatCount: null,
		repeatDur: null,
		requiredExtensions: M,
		requiredFeatures: M,
		requiredFonts: M,
		requiredFormats: M,
		resource: null,
		restart: null,
		result: null,
		rotate: null,
		rx: null,
		ry: null,
		scale: null,
		seed: null,
		shapeRendering: null,
		side: null,
		slope: null,
		snapshotTime: null,
		specularConstant: k,
		specularExponent: k,
		spreadMethod: null,
		spacing: null,
		startOffset: null,
		stdDeviation: null,
		stemh: null,
		stemv: null,
		stitchTiles: null,
		stopColor: null,
		stopOpacity: null,
		strikethroughPosition: k,
		strikethroughThickness: k,
		string: null,
		stroke: null,
		strokeDashArray: M,
		strokeDashOffset: null,
		strokeLineCap: null,
		strokeLineJoin: null,
		strokeMiterLimit: k,
		strokeOpacity: k,
		strokeWidth: null,
		style: null,
		surfaceScale: k,
		syncBehavior: null,
		syncBehaviorDefault: null,
		syncMaster: null,
		syncTolerance: null,
		syncToleranceDefault: null,
		systemLanguage: M,
		tabIndex: k,
		tableValues: null,
		target: null,
		targetX: k,
		targetY: k,
		textAnchor: null,
		textDecoration: null,
		textRendering: null,
		textLength: null,
		timelineBegin: null,
		title: null,
		transformBehavior: null,
		type: null,
		typeOf: M,
		to: null,
		transform: null,
		transformOrigin: null,
		u1: null,
		u2: null,
		underlinePosition: k,
		underlineThickness: k,
		unicode: null,
		unicodeBidi: null,
		unicodeRange: null,
		unitsPerEm: k,
		values: null,
		vAlphabetic: k,
		vMathematical: k,
		vectorEffect: null,
		vHanging: k,
		vIdeographic: k,
		version: null,
		vertAdvY: k,
		vertOriginX: k,
		vertOriginY: k,
		viewBox: null,
		viewTarget: null,
		visibility: null,
		width: null,
		widths: null,
		wordSpacing: null,
		writingMode: null,
		x: null,
		x1: null,
		x2: null,
		xChannelSelector: null,
		xHeight: k,
		y: null,
		y1: null,
		y2: null,
		yChannelSelector: null,
		z: null,
		zoomAndPan: null
	},
	space: "svg",
	transform: _e
}), xe = P({
	properties: {
		xLinkActuate: null,
		xLinkArcRole: null,
		xLinkHref: null,
		xLinkRole: null,
		xLinkShow: null,
		xLinkTitle: null,
		xLinkType: null
	},
	space: "xlink",
	transform(e, t) {
		return "xlink:" + t.slice(5).toLowerCase();
	}
}), Se = P({
	attributes: { xmlnsxlink: "xmlns:xlink" },
	properties: {
		xmlnsXLink: null,
		xmlns: null
	},
	space: "xmlns",
	transform: ve
}), Ce = P({
	properties: {
		xmlBase: null,
		xmlLang: null,
		xmlSpace: null
	},
	space: "xml",
	transform(e, t) {
		return "xml:" + t.slice(3).toLowerCase();
	}
}), we = {
	classId: "classID",
	dataType: "datatype",
	itemId: "itemID",
	strokeDashArray: "strokeDasharray",
	strokeDashOffset: "strokeDashoffset",
	strokeLineCap: "strokeLinecap",
	strokeLineJoin: "strokeLinejoin",
	strokeMiterLimit: "strokeMiterlimit",
	typeOf: "typeof",
	xLinkActuate: "xlinkActuate",
	xLinkArcRole: "xlinkArcrole",
	xLinkHref: "xlinkHref",
	xLinkRole: "xlinkRole",
	xLinkShow: "xlinkShow",
	xLinkTitle: "xlinkTitle",
	xLinkType: "xlinkType",
	xmlnsXLink: "xmlnsXlink"
}, Te = /[A-Z]/g, Ee = /-[a-z]/g, De = /^data[-\w.:]+$/i;
function Oe(e, t) {
	let n = ue(t), r = t, i = T;
	if (n in e.normal) return e.property[e.normal[n]];
	if (n.length > 4 && n.slice(0, 4) === "data" && De.test(t)) {
		if (t.charAt(4) === "-") {
			let e = t.slice(5).replace(Ee, Ae);
			r = "data" + e.charAt(0).toUpperCase() + e.slice(1);
		} else {
			let e = t.slice(4);
			if (!Ee.test(e)) {
				let n = e.replace(Te, ke);
				n.charAt(0) !== "-" && (n = "-" + n), t = "data" + n;
			}
		}
		i = me;
	}
	return new i(r, t);
}
function ke(e) {
	return "-" + e.toLowerCase();
}
function Ae(e) {
	return e.charAt(1).toUpperCase();
}
// node_modules/.bun/property-information@7.1.0/node_modules/property-information/index.js
var je = le([
	ge,
	ye,
	xe,
	Se,
	Ce
], "html"), F = le([
	ge,
	be,
	xe,
	Se,
	Ce
], "svg");
// node_modules/.bun/space-separated-tokens@2.0.2/node_modules/space-separated-tokens/index.js
function Me(e) {
	return e.join(" ").trim();
}
// node_modules/.bun/inline-style-parser@0.2.7/node_modules/inline-style-parser/cjs/index.js
var Ne = /* @__PURE__ */ n(((e, t) => {
	var n = /\/\*[^*]*\*+([^/*][^*]*\*+)*\//g, r = /\n/g, i = /^\s*/, a = /^(\*?[-#/*\\\w]+(\[[0-9a-z_-]+\])?)\s*/, o = /^:\s*/, s = /^((?:'(?:\\'|.)*?'|"(?:\\"|.)*?"|\([^)]*?\)|[^};])+)/, c = /^[;\s]*/, l = /^\s+|\s+$/g;
	function u(e, t) {
		if (typeof e != "string") throw TypeError("First argument must be a string");
		if (!e) return [];
		t ||= {};
		var l = 1, u = 1;
		function f(e) {
			var t = e.match(r);
			t && (l += t.length);
			var n = e.lastIndexOf("\n");
			u = ~n ? e.length - n : u + e.length;
		}
		function p() {
			var e = {
				line: l,
				column: u
			};
			return function(t) {
				return t.position = new m(e), g(), t;
			};
		}
		function m(e) {
			this.start = e, this.end = {
				line: l,
				column: u
			}, this.source = t.source;
		}
		m.prototype.content = e;
		function ee(n) {
			var r = /* @__PURE__ */ Error(t.source + ":" + l + ":" + u + ": " + n);
			if (r.reason = n, r.filename = t.source, r.line = l, r.column = u, r.source = e, !t.silent) throw r;
		}
		function h(t) {
			var n = t.exec(e);
			if (n) {
				var r = n[0];
				return f(r), e = e.slice(r.length), n;
			}
		}
		function g() {
			h(i);
		}
		function _(e) {
			var t;
			for (e ||= []; t = v();) t !== !1 && e.push(t);
			return e;
		}
		function v() {
			var t = p();
			if (e.charAt(0) == "/" && e.charAt(1) == "*") {
				for (var n = 2; e.charAt(n) != "" && (e.charAt(n) != "*" || e.charAt(n + 1) != "/");) ++n;
				if (n += 2, e.charAt(n - 1) === "") return ee("End of comment missing");
				var r = e.slice(2, n - 2);
				return u += 2, f(r), e = e.slice(n), u += 2, t({
					type: "comment",
					comment: r
				});
			}
		}
		function y() {
			var e = p(), t = h(a);
			if (t) {
				if (v(), !h(o)) return ee("property missing ':'");
				var r = h(s), i = e({
					type: "declaration",
					property: d(t[0].replace(n, "")),
					value: r ? d(r[0].replace(n, "")) : ""
				});
				return h(c), i;
			}
		}
		function b() {
			var e = [];
			_(e);
			for (var t; t = y();) t !== !1 && (e.push(t), _(e));
			return e;
		}
		return g(), b();
	}
	function d(e) {
		return e ? e.replace(l, "") : "";
	}
	t.exports = u;
})), Pe = /* @__PURE__ */ n(((e, t, n) => {
	var r = n && n.__importDefault || function(e) {
		return e && e.__esModule ? e : { default: e };
	};
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = a;
	var i = r(Ne());
	function a(e, t) {
		let n = null;
		if (!e || typeof e != "string") return n;
		let r = (0, i.default)(e), a = typeof t == "function";
		return r.forEach((e) => {
			if (e.type !== "declaration") return;
			let { property: r, value: i } = e;
			a ? t(r, i, e) : i && (n ||= {}, n[r] = i);
		}), n;
	}
})), Fe = /* @__PURE__ */ n(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.camelCase = void 0;
	var t = /^--[a-zA-Z0-9_-]+$/, n = /-([a-z])/g, r = /^[^-]+$/, i = /^-(webkit|moz|ms|o|khtml)-/, a = /^-(ms)-/, o = function(e) {
		return !e || r.test(e) || t.test(e);
	}, s = function(e, t) {
		return t.toUpperCase();
	}, c = function(e, t) {
		return `${t}-`;
	};
	e.camelCase = function(e, t) {
		return t === void 0 && (t = {}), o(e) ? e : (e = e.toLowerCase(), e = t.reactCompat ? e.replace(a, c) : e.replace(i, c), e.replace(n, s));
	};
})), Ie = /* @__PURE__ */ n(((e, t, n) => {
	var r = (n && n.__importDefault || function(e) {
		return e && e.__esModule ? e : { default: e };
	})(Pe()), i = Fe();
	function a(e, t) {
		var n = {};
		return !e || typeof e != "string" || (0, r.default)(e, function(e, r) {
			e && r && (n[(0, i.camelCase)(e, t)] = r);
		}), n;
	}
	a.default = a, t.exports = a;
})), Le = Re("end"), I = Re("start");
function Re(e) {
	return t;
	function t(t) {
		let n = t && t.position && t.position[e] || {};
		if (typeof n.line == "number" && n.line > 0 && typeof n.column == "number" && n.column > 0) return {
			line: n.line,
			column: n.column,
			offset: typeof n.offset == "number" && n.offset > -1 ? n.offset : void 0
		};
	}
}
function ze(e) {
	let t = I(e), n = Le(e);
	if (t && n) return {
		start: t,
		end: n
	};
}
// node_modules/.bun/vfile-message@4.0.3/node_modules/vfile-message/lib/index.js
var L = class extends Error {
	constructor(e, t, n) {
		super(), typeof t == "string" && (n = t, t = void 0);
		let r = "", a = {}, o = !1;
		if (t && (a = "line" in t && "column" in t || "start" in t && "end" in t ? { place: t } : "type" in t ? {
			ancestors: [t],
			place: t.position
		} : { ...t }), typeof e == "string" ? r = e : !a.cause && e && (o = !0, r = e.message, a.cause = e), !a.ruleId && !a.source && typeof n == "string") {
			let e = n.indexOf(":");
			e === -1 ? a.ruleId = n : (a.source = n.slice(0, e), a.ruleId = n.slice(e + 1));
		}
		if (!a.place && a.ancestors && a.ancestors) {
			let e = a.ancestors[a.ancestors.length - 1];
			e && (a.place = e.position);
		}
		let s = a.place && "start" in a.place ? a.place.start : a.place;
		this.ancestors = a.ancestors || void 0, this.cause = a.cause || void 0, this.column = s ? s.column : void 0, this.fatal = void 0, this.file = "", this.message = r, this.line = s ? s.line : void 0, this.name = i(a.place) || "1:1", this.place = a.place || void 0, this.reason = this.message, this.ruleId = a.ruleId || void 0, this.source = a.source || void 0, this.stack = o && a.cause && typeof a.cause.stack == "string" ? a.cause.stack : "", this.actual = void 0, this.expected = void 0, this.note = void 0, this.url = void 0;
	}
};
L.prototype.file = "", L.prototype.name = "", L.prototype.reason = "", L.prototype.message = "", L.prototype.stack = "", L.prototype.column = void 0, L.prototype.line = void 0, L.prototype.ancestors = void 0, L.prototype.cause = void 0, L.prototype.fatal = void 0, L.prototype.place = void 0, L.prototype.ruleId = void 0, L.prototype.source = void 0;
// node_modules/.bun/hast-util-to-jsx-runtime@2.3.6/node_modules/hast-util-to-jsx-runtime/lib/index.js
var Be = /* @__PURE__ */ e(Ie(), 1), R = {}.hasOwnProperty, Ve = /* @__PURE__ */ new Map(), He = /[A-Z]/g, Ue = /* @__PURE__ */ new Set([
	"table",
	"tbody",
	"thead",
	"tfoot",
	"tr"
]), We = /* @__PURE__ */ new Set(["td", "th"]), Ge = "https://github.com/syntax-tree/hast-util-to-jsx-runtime";
function Ke(e, t) {
	if (!t || t.Fragment === void 0) throw TypeError("Expected `Fragment` in options");
	let n = t.filePath || void 0, r;
	if (t.development) {
		if (typeof t.jsxDEV != "function") throw TypeError("Expected `jsxDEV` in options when `development: true`");
		r = nt(n, t.jsxDEV);
	} else {
		if (typeof t.jsx != "function") throw TypeError("Expected `jsx` in production options");
		if (typeof t.jsxs != "function") throw TypeError("Expected `jsxs` in production options");
		r = tt(n, t.jsx, t.jsxs);
	}
	let i = {
		Fragment: t.Fragment,
		ancestors: [],
		components: t.components || {},
		create: r,
		elementAttributeNameCase: t.elementAttributeNameCase || "react",
		evaluater: t.createEvaluater ? t.createEvaluater() : void 0,
		filePath: n,
		ignoreInvalidStyle: t.ignoreInvalidStyle || !1,
		passKeys: t.passKeys !== !1,
		passNode: t.passNode || !1,
		schema: t.space === "svg" ? F : je,
		stylePropertyNameCase: t.stylePropertyNameCase || "dom",
		tableCellAlignToStyle: t.tableCellAlignToStyle !== !1
	}, a = qe(i, e, void 0);
	return a && typeof a != "string" ? a : i.create(e, i.Fragment, { children: a || void 0 }, void 0);
}
function qe(e, t, n) {
	if (t.type === "element") return Je(e, t, n);
	if (t.type === "mdxFlowExpression" || t.type === "mdxTextExpression") return Ye(e, t);
	if (t.type === "mdxJsxFlowElement" || t.type === "mdxJsxTextElement") return Ze(e, t, n);
	if (t.type === "mdxjsEsm") return Xe(e, t);
	if (t.type === "root") return Qe(e, t, n);
	if (t.type === "text") return $e(e, t);
}
function Je(e, t, n) {
	let r = e.schema, i = r;
	t.tagName.toLowerCase() === "svg" && r.space === "html" && (i = F, e.schema = i), e.ancestors.push(t);
	let a = st(e, t.tagName, !1), o = rt(e, t), s = B(e, t);
	return Ue.has(t.tagName) && (s = s.filter(function(e) {
		return typeof e != "string" || !se(e);
	})), et(e, o, a, t), z(o, s), e.ancestors.pop(), e.schema = r, e.create(t, a, o, n);
}
function Ye(e, t) {
	if (t.data && t.data.estree && e.evaluater) {
		let n = t.data.estree.body[0];
		return n.type, e.evaluater.evaluateExpression(n.expression);
	}
	V(e, t.position);
}
function Xe(e, t) {
	if (t.data && t.data.estree && e.evaluater) return e.evaluater.evaluateProgram(t.data.estree);
	V(e, t.position);
}
function Ze(e, t, n) {
	let r = e.schema, i = r;
	t.name === "svg" && r.space === "html" && (i = F, e.schema = i), e.ancestors.push(t);
	let a = t.name === null ? e.Fragment : st(e, t.name, !0), o = it(e, t), s = B(e, t);
	return et(e, o, a, t), z(o, s), e.ancestors.pop(), e.schema = r, e.create(t, a, o, n);
}
function Qe(e, t, n) {
	let r = {};
	return z(r, B(e, t)), e.create(t, e.Fragment, r, n);
}
function $e(e, t) {
	return t.value;
}
function et(e, t, n, r) {
	typeof n != "string" && n !== e.Fragment && e.passNode && (t.node = r);
}
function z(e, t) {
	if (t.length > 0) {
		let n = t.length > 1 ? t : t[0];
		n && (e.children = n);
	}
}
function tt(e, t, n) {
	return r;
	function r(e, r, i, a) {
		let o = Array.isArray(i.children) ? n : t;
		return a ? o(r, i, a) : o(r, i);
	}
}
function nt(e, t) {
	return n;
	function n(n, r, i, a) {
		let o = Array.isArray(i.children), s = I(n);
		return t(r, i, a, o, {
			columnNumber: s ? s.column - 1 : void 0,
			fileName: e,
			lineNumber: s ? s.line : void 0
		}, void 0);
	}
}
function rt(e, t) {
	let n = {}, r, i;
	for (i in t.properties) if (i !== "children" && R.call(t.properties, i)) {
		let a = at(e, i, t.properties[i]);
		if (a) {
			let [i, o] = a;
			e.tableCellAlignToStyle && i === "align" && typeof o == "string" && We.has(t.tagName) ? r = o : n[i] = o;
		}
	}
	if (r) {
		let t = n.style ||= {};
		t[e.stylePropertyNameCase === "css" ? "text-align" : "textAlign"] = r;
	}
	return n;
}
function it(e, t) {
	let n = {};
	for (let r of t.attributes) if (r.type === "mdxJsxExpressionAttribute") {
		if (r.data && r.data.estree && e.evaluater) {
			let t = r.data.estree.body[0];
			t.type;
			let i = t.expression;
			i.type;
			let a = i.properties[0];
			a.type, Object.assign(n, e.evaluater.evaluateExpression(a.argument));
		} else V(e, t.position);
	} else {
		let i = r.name, a;
		if (r.value && typeof r.value == "object") {
			if (r.value.data && r.value.data.estree && e.evaluater) {
				let t = r.value.data.estree.body[0];
				t.type, a = e.evaluater.evaluateExpression(t.expression);
			} else V(e, t.position);
		} else a = r.value === null || r.value;
		n[i] = a;
	}
	return n;
}
function B(e, t) {
	let n = [], r = -1, i = e.passKeys ? /* @__PURE__ */ new Map() : Ve;
	for (; ++r < t.children.length;) {
		let a = t.children[r], o;
		if (e.passKeys) {
			let e = a.type === "element" ? a.tagName : a.type === "mdxJsxFlowElement" || a.type === "mdxJsxTextElement" ? a.name : void 0;
			if (e) {
				let t = i.get(e) || 0;
				o = e + "-" + t, i.set(e, t + 1);
			}
		}
		let s = qe(e, a, o);
		s !== void 0 && n.push(s);
	}
	return n;
}
function at(e, t, n) {
	let r = Oe(e.schema, t);
	if (!(n == null || typeof n == "number" && Number.isNaN(n))) {
		if (Array.isArray(n) && (n = r.commaSeparated ? S(n) : Me(n)), r.property === "style") {
			let t = typeof n == "object" ? n : ot(e, String(n));
			return e.stylePropertyNameCase === "css" && (t = ct(t)), ["style", t];
		}
		return [e.elementAttributeNameCase === "react" && r.space ? we[r.property] || r.property : r.attribute, n];
	}
}
function ot(e, t) {
	try {
		return (0, Be.default)(t, { reactCompat: !0 });
	} catch (t) {
		if (e.ignoreInvalidStyle) return {};
		let n = t, r = new L("Cannot parse `style` attribute", {
			ancestors: e.ancestors,
			cause: n,
			ruleId: "style",
			source: "hast-util-to-jsx-runtime"
		});
		throw r.file = e.filePath || void 0, r.url = Ge + "#cannot-parse-style-attribute", r;
	}
}
function st(e, t, n) {
	let r;
	if (!n) r = {
		type: "Literal",
		value: t
	};
	else if (t.includes(".")) {
		let e = t.split("."), n = -1, i;
		for (; ++n < e.length;) {
			let t = ae(e[n]) ? {
				type: "Identifier",
				name: e[n]
			} : {
				type: "Literal",
				value: e[n]
			};
			i = i ? {
				type: "MemberExpression",
				object: i,
				property: t,
				computed: !!(n && t.type === "Literal"),
				optional: !1
			} : t;
		}
		r = i;
	} else r = ae(t) && !/^[a-z]/.test(t) ? {
		type: "Identifier",
		name: t
	} : {
		type: "Literal",
		value: t
	};
	if (r.type === "Literal") {
		let t = r.value;
		return R.call(e.components, t) ? e.components[t] : t;
	}
	if (e.evaluater) return e.evaluater.evaluateExpression(r);
	V(e);
}
function V(e, t) {
	let n = new L("Cannot handle MDX estrees without `createEvaluater`", {
		ancestors: e.ancestors,
		place: t,
		ruleId: "mdx-estree",
		source: "hast-util-to-jsx-runtime"
	});
	throw n.file = e.filePath || void 0, n.url = Ge + "#cannot-handle-mdx-estrees-without-createevaluater", n;
}
function ct(e) {
	let t = {}, n;
	for (n in e) R.call(e, n) && (t[lt(n)] = e[n]);
	return t;
}
function lt(e) {
	let t = e.replace(He, ut);
	return t.slice(0, 3) === "ms-" && (t = "-" + t), t;
}
function ut(e) {
	return "-" + e.toLowerCase();
}
// node_modules/.bun/html-url-attributes@3.0.1/node_modules/html-url-attributes/lib/index.js
var H = {
	action: ["form"],
	cite: [
		"blockquote",
		"del",
		"ins",
		"q"
	],
	data: ["object"],
	formAction: ["button", "input"],
	href: [
		"a",
		"area",
		"base",
		"link"
	],
	icon: ["menuitem"],
	itemId: null,
	manifest: ["html"],
	ping: ["a", "area"],
	poster: ["video"],
	src: [
		"audio",
		"embed",
		"iframe",
		"img",
		"input",
		"script",
		"source",
		"track",
		"video"
	]
};
// node_modules/.bun/micromark-util-sanitize-uri@2.0.1/node_modules/micromark-util-sanitize-uri/index.js
function U(e) {
	let t = [], n = -1, r = 0, i = 0;
	for (; ++n < e.length;) {
		let o = e.charCodeAt(n), s = "";
		if (o === 37 && a(e.charCodeAt(n + 1)) && a(e.charCodeAt(n + 2))) i = 2;
		else if (o < 128) /[!#$&-;=?-Z_a-z~]/.test(String.fromCharCode(o)) || (s = String.fromCharCode(o));
		else if (o > 55295 && o < 57344) {
			let t = e.charCodeAt(n + 1);
			o < 56320 && t > 56319 && t < 57344 ? (s = String.fromCharCode(o, t), i = 1) : s = "�";
		} else s = String.fromCharCode(o);
		s &&= (t.push(e.slice(r, n), encodeURIComponent(s)), r = n + i + 1, ""), i &&= (n += i, 0);
	}
	return t.join("") + e.slice(r);
}
// node_modules/.bun/remark-parse@11.0.0/node_modules/remark-parse/lib/index.js
function dt(e) {
	let t = this;
	t.parser = n;
	function n(n) {
		return o(n, {
			...t.data("settings"),
			...e,
			extensions: t.data("micromarkExtensions") || [],
			mdastExtensions: t.data("fromMarkdownExtensions") || []
		});
	}
}
// node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/blockquote.js
function ft(e, t) {
	let n = {
		type: "element",
		tagName: "blockquote",
		properties: {},
		children: e.wrap(e.all(t), !0)
	};
	return e.patch(t, n), e.applyData(t, n);
}
// node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/break.js
function pt(e, t) {
	let n = {
		type: "element",
		tagName: "br",
		properties: {},
		children: []
	};
	return e.patch(t, n), [e.applyData(t, n), {
		type: "text",
		value: "\n"
	}];
}
// node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/code.js
function mt(e, t) {
	let n = t.value ? t.value + "\n" : "", r = {}, i = t.lang ? t.lang.split(/\s+/) : [];
	i.length > 0 && (r.className = ["language-" + i[0]]);
	let a = {
		type: "element",
		tagName: "code",
		properties: r,
		children: [{
			type: "text",
			value: n
		}]
	};
	return t.meta && (a.data = { meta: t.meta }), e.patch(t, a), a = e.applyData(t, a), a = {
		type: "element",
		tagName: "pre",
		properties: {},
		children: [a]
	}, e.patch(t, a), a;
}
// node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/delete.js
function ht(e, t) {
	let n = {
		type: "element",
		tagName: "del",
		properties: {},
		children: e.all(t)
	};
	return e.patch(t, n), e.applyData(t, n);
}
// node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/emphasis.js
function gt(e, t) {
	let n = {
		type: "element",
		tagName: "em",
		properties: {},
		children: e.all(t)
	};
	return e.patch(t, n), e.applyData(t, n);
}
// node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/footnote-reference.js
function _t(e, t) {
	let n = typeof e.options.clobberPrefix == "string" ? e.options.clobberPrefix : "user-content-", r = String(t.identifier).toUpperCase(), i = U(r.toLowerCase()), a = e.footnoteOrder.indexOf(r), o, s = e.footnoteCounts.get(r);
	s === void 0 ? (s = 0, e.footnoteOrder.push(r), o = e.footnoteOrder.length) : o = a + 1, s += 1, e.footnoteCounts.set(r, s);
	let c = {
		type: "element",
		tagName: "a",
		properties: {
			href: "#" + n + "fn-" + i,
			id: n + "fnref-" + i + (s > 1 ? "-" + s : ""),
			dataFootnoteRef: !0,
			ariaDescribedBy: ["footnote-label"]
		},
		children: [{
			type: "text",
			value: String(o)
		}]
	};
	e.patch(t, c);
	let l = {
		type: "element",
		tagName: "sup",
		properties: {},
		children: [c]
	};
	return e.patch(t, l), e.applyData(t, l);
}
// node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/heading.js
function vt(e, t) {
	let n = {
		type: "element",
		tagName: "h" + t.depth,
		properties: {},
		children: e.all(t)
	};
	return e.patch(t, n), e.applyData(t, n);
}
// node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/html.js
function yt(e, t) {
	if (e.options.allowDangerousHtml) {
		let n = {
			type: "raw",
			value: t.value
		};
		return e.patch(t, n), e.applyData(t, n);
	}
}
// node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/revert.js
function bt(e, t) {
	let n = t.referenceType, r = "]";
	if (n === "collapsed" ? r += "[]" : n === "full" && (r += "[" + (t.label || t.identifier) + "]"), t.type === "imageReference") return [{
		type: "text",
		value: "![" + t.alt + r
	}];
	let i = e.all(t), a = i[0];
	a && a.type === "text" ? a.value = "[" + a.value : i.unshift({
		type: "text",
		value: "["
	});
	let o = i[i.length - 1];
	return o && o.type === "text" ? o.value += r : i.push({
		type: "text",
		value: r
	}), i;
}
// node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/image-reference.js
function xt(e, t) {
	let n = String(t.identifier).toUpperCase(), r = e.definitionById.get(n);
	if (!r) return bt(e, t);
	let i = {
		src: U(r.url || ""),
		alt: t.alt
	};
	r.title !== null && r.title !== void 0 && (i.title = r.title);
	let a = {
		type: "element",
		tagName: "img",
		properties: i,
		children: []
	};
	return e.patch(t, a), e.applyData(t, a);
}
// node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/image.js
function St(e, t) {
	let n = { src: U(t.url) };
	t.alt !== null && t.alt !== void 0 && (n.alt = t.alt), t.title !== null && t.title !== void 0 && (n.title = t.title);
	let r = {
		type: "element",
		tagName: "img",
		properties: n,
		children: []
	};
	return e.patch(t, r), e.applyData(t, r);
}
// node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/inline-code.js
function Ct(e, t) {
	let n = {
		type: "text",
		value: t.value.replace(/\r?\n|\r/g, " ")
	};
	e.patch(t, n);
	let r = {
		type: "element",
		tagName: "code",
		properties: {},
		children: [n]
	};
	return e.patch(t, r), e.applyData(t, r);
}
// node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/link-reference.js
function wt(e, t) {
	let n = String(t.identifier).toUpperCase(), r = e.definitionById.get(n);
	if (!r) return bt(e, t);
	let i = { href: U(r.url || "") };
	r.title !== null && r.title !== void 0 && (i.title = r.title);
	let a = {
		type: "element",
		tagName: "a",
		properties: i,
		children: e.all(t)
	};
	return e.patch(t, a), e.applyData(t, a);
}
// node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/link.js
function Tt(e, t) {
	let n = { href: U(t.url) };
	t.title !== null && t.title !== void 0 && (n.title = t.title);
	let r = {
		type: "element",
		tagName: "a",
		properties: n,
		children: e.all(t)
	};
	return e.patch(t, r), e.applyData(t, r);
}
// node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/list-item.js
function Et(e, t, n) {
	let r = e.all(t), i = n ? Dt(n) : Ot(t), a = {}, o = [];
	if (typeof t.checked == "boolean") {
		let e = r[0], n;
		e && e.type === "element" && e.tagName === "p" ? n = e : (n = {
			type: "element",
			tagName: "p",
			properties: {},
			children: []
		}, r.unshift(n)), n.children.length > 0 && n.children.unshift({
			type: "text",
			value: " "
		}), n.children.unshift({
			type: "element",
			tagName: "input",
			properties: {
				type: "checkbox",
				checked: t.checked,
				disabled: !0
			},
			children: []
		}), a.className = ["task-list-item"];
	}
	let s = -1;
	for (; ++s < r.length;) {
		let e = r[s];
		(i || s !== 0 || e.type !== "element" || e.tagName !== "p") && o.push({
			type: "text",
			value: "\n"
		}), e.type === "element" && e.tagName === "p" && !i ? o.push(...e.children) : o.push(e);
	}
	let c = r[r.length - 1];
	c && (i || c.type !== "element" || c.tagName !== "p") && o.push({
		type: "text",
		value: "\n"
	});
	let l = {
		type: "element",
		tagName: "li",
		properties: a,
		children: o
	};
	return e.patch(t, l), e.applyData(t, l);
}
function Dt(e) {
	let t = !1;
	if (e.type === "list") {
		t = e.spread || !1;
		let n = e.children, r = -1;
		for (; !t && ++r < n.length;) t = Ot(n[r]);
	}
	return t;
}
function Ot(e) {
	return e.spread ?? e.children.length > 1;
}
// node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/list.js
function kt(e, t) {
	let n = {}, r = e.all(t), i = -1;
	for (typeof t.start == "number" && t.start !== 1 && (n.start = t.start); ++i < r.length;) {
		let e = r[i];
		if (e.type === "element" && e.tagName === "li" && e.properties && Array.isArray(e.properties.className) && e.properties.className.includes("task-list-item")) {
			n.className = ["contains-task-list"];
			break;
		}
	}
	let a = {
		type: "element",
		tagName: t.ordered ? "ol" : "ul",
		properties: n,
		children: e.wrap(r, !0)
	};
	return e.patch(t, a), e.applyData(t, a);
}
// node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/paragraph.js
function At(e, t) {
	let n = {
		type: "element",
		tagName: "p",
		properties: {},
		children: e.all(t)
	};
	return e.patch(t, n), e.applyData(t, n);
}
// node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/root.js
function jt(e, t) {
	let n = {
		type: "root",
		children: e.wrap(e.all(t))
	};
	return e.patch(t, n), e.applyData(t, n);
}
// node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/strong.js
function Mt(e, t) {
	let n = {
		type: "element",
		tagName: "strong",
		properties: {},
		children: e.all(t)
	};
	return e.patch(t, n), e.applyData(t, n);
}
// node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/table.js
function Nt(e, t) {
	let n = e.all(t), r = n.shift(), i = [];
	if (r) {
		let n = {
			type: "element",
			tagName: "thead",
			properties: {},
			children: e.wrap([r], !0)
		};
		e.patch(t.children[0], n), i.push(n);
	}
	if (n.length > 0) {
		let r = {
			type: "element",
			tagName: "tbody",
			properties: {},
			children: e.wrap(n, !0)
		}, a = I(t.children[1]), o = Le(t.children[t.children.length - 1]);
		a && o && (r.position = {
			start: a,
			end: o
		}), i.push(r);
	}
	let a = {
		type: "element",
		tagName: "table",
		properties: {},
		children: e.wrap(i, !0)
	};
	return e.patch(t, a), e.applyData(t, a);
}
// node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/table-row.js
function Pt(e, t, n) {
	let r = n ? n.children : void 0, i = (r ? r.indexOf(t) : 1) === 0 ? "th" : "td", a = n && n.type === "table" ? n.align : void 0, o = a ? a.length : t.children.length, s = -1, c = [];
	for (; ++s < o;) {
		let n = t.children[s], r = {}, o = a ? a[s] : void 0;
		o && (r.align = o);
		let l = {
			type: "element",
			tagName: i,
			properties: r,
			children: []
		};
		n && (l.children = e.all(n), e.patch(n, l), l = e.applyData(n, l)), c.push(l);
	}
	let l = {
		type: "element",
		tagName: "tr",
		properties: {},
		children: e.wrap(c, !0)
	};
	return e.patch(t, l), e.applyData(t, l);
}
// node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/table-cell.js
function Ft(e, t) {
	let n = {
		type: "element",
		tagName: "td",
		properties: {},
		children: e.all(t)
	};
	return e.patch(t, n), e.applyData(t, n);
}
// node_modules/.bun/trim-lines@3.0.1/node_modules/trim-lines/index.js
var It = 9, Lt = 32;
function Rt(e) {
	let t = String(e), n = /\r?\n|\r/g, r = n.exec(t), i = 0, a = [];
	for (; r;) a.push(zt(t.slice(i, r.index), i > 0, !0), r[0]), i = r.index + r[0].length, r = n.exec(t);
	return a.push(zt(t.slice(i), i > 0, !1)), a.join("");
}
function zt(e, t, n) {
	let r = 0, i = e.length;
	if (t) {
		let t = e.codePointAt(r);
		for (; t === It || t === Lt;) r++, t = e.codePointAt(r);
	}
	if (n) {
		let t = e.codePointAt(i - 1);
		for (; t === It || t === Lt;) i--, t = e.codePointAt(i - 1);
	}
	return i > r ? e.slice(r, i) : "";
}
// node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/text.js
function Bt(e, t) {
	let n = {
		type: "text",
		value: Rt(String(t.value))
	};
	return e.patch(t, n), e.applyData(t, n);
}
// node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/thematic-break.js
function Vt(e, t) {
	let n = {
		type: "element",
		tagName: "hr",
		properties: {},
		children: []
	};
	return e.patch(t, n), e.applyData(t, n);
}
// node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/index.js
var Ht = {
	blockquote: ft,
	break: pt,
	code: mt,
	delete: ht,
	emphasis: gt,
	footnoteReference: _t,
	heading: vt,
	html: yt,
	imageReference: xt,
	image: St,
	inlineCode: Ct,
	linkReference: wt,
	link: Tt,
	listItem: Et,
	list: kt,
	paragraph: At,
	root: jt,
	strong: Mt,
	table: Nt,
	tableCell: Ft,
	tableRow: Pt,
	text: Bt,
	thematicBreak: Vt,
	toml: W,
	yaml: W,
	definition: W,
	footnoteDefinition: W
};
function W() {}
// node_modules/.bun/@ungap+structured-clone@1.3.0/node_modules/@ungap/structured-clone/esm/deserialize.js
var Ut = typeof self == "object" ? self : globalThis, Wt = (e, t) => {
	let n = (t, n) => (e.set(n, t), t), r = (i) => {
		if (e.has(i)) return e.get(i);
		let [a, o] = t[i];
		switch (a) {
			case 0:
			case -1: return n(o, i);
			case 1: {
				let e = n([], i);
				for (let t of o) e.push(r(t));
				return e;
			}
			case 2: {
				let e = n({}, i);
				for (let [t, n] of o) e[r(t)] = r(n);
				return e;
			}
			case 3: return n(new Date(o), i);
			case 4: {
				let { source: e, flags: t } = o;
				return n(new RegExp(e, t), i);
			}
			case 5: {
				let e = n(/* @__PURE__ */ new Map(), i);
				for (let [t, n] of o) e.set(r(t), r(n));
				return e;
			}
			case 6: {
				let e = n(/* @__PURE__ */ new Set(), i);
				for (let t of o) e.add(r(t));
				return e;
			}
			case 7: {
				let { name: e, message: t } = o;
				return n(new Ut[e](t), i);
			}
			case 8: return n(BigInt(o), i);
			case "BigInt": return n(Object(BigInt(o)), i);
			case "ArrayBuffer": return n(new Uint8Array(o).buffer, o);
			case "DataView": {
				let { buffer: e } = new Uint8Array(o);
				return n(new DataView(e), o);
			}
		}
		return n(new Ut[a](o), i);
	};
	return r;
}, Gt = (e) => Wt(/* @__PURE__ */ new Map(), e)(0), G = "", { toString: Kt } = {}, { keys: qt } = Object, K = (e) => {
	let t = typeof e;
	if (t !== "object" || !e) return [0, t];
	let n = Kt.call(e).slice(8, -1);
	switch (n) {
		case "Array": return [1, G];
		case "Object": return [2, G];
		case "Date": return [3, G];
		case "RegExp": return [4, G];
		case "Map": return [5, G];
		case "Set": return [6, G];
		case "DataView": return [1, n];
	}
	return n.includes("Array") ? [1, n] : n.includes("Error") ? [7, n] : [2, n];
}, q = ([e, t]) => e === 0 && (t === "function" || t === "symbol"), Jt = (e, t, n, r) => {
	let i = (e, t) => {
		let i = r.push(e) - 1;
		return n.set(t, i), i;
	}, a = (r) => {
		if (n.has(r)) return n.get(r);
		let [o, s] = K(r);
		switch (o) {
			case 0: {
				let t = r;
				switch (s) {
					case "bigint":
						o = 8, t = r.toString();
						break;
					case "function":
					case "symbol":
						if (e) throw TypeError("unable to serialize " + s);
						t = null;
						break;
					case "undefined": return i([-1], r);
				}
				return i([o, t], r);
			}
			case 1: {
				if (s) {
					let e = r;
					return s === "DataView" ? e = new Uint8Array(r.buffer) : s === "ArrayBuffer" && (e = new Uint8Array(r)), i([s, [...e]], r);
				}
				let e = [], t = i([o, e], r);
				for (let t of r) e.push(a(t));
				return t;
			}
			case 2: {
				if (s) switch (s) {
					case "BigInt": return i([s, r.toString()], r);
					case "Boolean":
					case "Number":
					case "String": return i([s, r.valueOf()], r);
				}
				if (t && "toJSON" in r) return a(r.toJSON());
				let n = [], c = i([o, n], r);
				for (let t of qt(r)) (e || !q(K(r[t]))) && n.push([a(t), a(r[t])]);
				return c;
			}
			case 3: return i([o, r.toISOString()], r);
			case 4: {
				let { source: e, flags: t } = r;
				return i([o, {
					source: e,
					flags: t
				}], r);
			}
			case 5: {
				let t = [], n = i([o, t], r);
				for (let [n, i] of r) (e || !(q(K(n)) || q(K(i)))) && t.push([a(n), a(i)]);
				return n;
			}
			case 6: {
				let t = [], n = i([o, t], r);
				for (let n of r) (e || !q(K(n))) && t.push(a(n));
				return n;
			}
		}
		let { message: c } = r;
		return i([o, {
			name: s,
			message: c
		}], r);
	};
	return a;
}, Yt = (e, { json: t, lossy: n } = {}) => {
	let r = [];
	return Jt(!(t || n), !!t, /* @__PURE__ */ new Map(), r)(e), r;
}, J = typeof structuredClone == "function" ? 
/* c8 ignore start */
(e, t) => t && ("json" in t || "lossy" in t) ? Gt(Yt(e, t)) : structuredClone(e) : (e, t) => Gt(Yt(e, t));
// node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/footer.js
function Xt(e, t) {
	let n = [{
		type: "text",
		value: "↩"
	}];
	return t > 1 && n.push({
		type: "element",
		tagName: "sup",
		properties: {},
		children: [{
			type: "text",
			value: String(t)
		}]
	}), n;
}
function Zt(e, t) {
	return "Back to reference " + (e + 1) + (t > 1 ? "-" + t : "");
}
function Qt(e) {
	let t = typeof e.options.clobberPrefix == "string" ? e.options.clobberPrefix : "user-content-", n = e.options.footnoteBackContent || Xt, r = e.options.footnoteBackLabel || Zt, i = e.options.footnoteLabel || "Footnotes", a = e.options.footnoteLabelTagName || "h2", o = e.options.footnoteLabelProperties || { className: ["sr-only"] }, s = [], c = -1;
	for (; ++c < e.footnoteOrder.length;) {
		let i = e.footnoteById.get(e.footnoteOrder[c]);
		if (!i) continue;
		let a = e.all(i), o = String(i.identifier).toUpperCase(), l = U(o.toLowerCase()), u = 0, d = [], f = e.footnoteCounts.get(o);
		for (; f !== void 0 && ++u <= f;) {
			d.length > 0 && d.push({
				type: "text",
				value: " "
			});
			let e = typeof n == "string" ? n : n(c, u);
			typeof e == "string" && (e = {
				type: "text",
				value: e
			}), d.push({
				type: "element",
				tagName: "a",
				properties: {
					href: "#" + t + "fnref-" + l + (u > 1 ? "-" + u : ""),
					dataFootnoteBackref: "",
					ariaLabel: typeof r == "string" ? r : r(c, u),
					className: ["data-footnote-backref"]
				},
				children: Array.isArray(e) ? e : [e]
			});
		}
		let p = a[a.length - 1];
		if (p && p.type === "element" && p.tagName === "p") {
			let e = p.children[p.children.length - 1];
			e && e.type === "text" ? e.value += " " : p.children.push({
				type: "text",
				value: " "
			}), p.children.push(...d);
		} else a.push(...d);
		let m = {
			type: "element",
			tagName: "li",
			properties: { id: t + "fn-" + l },
			children: e.wrap(a, !0)
		};
		e.patch(i, m), s.push(m);
	}
	if (s.length !== 0) return {
		type: "element",
		tagName: "section",
		properties: {
			dataFootnotes: !0,
			className: ["footnotes"]
		},
		children: [
			{
				type: "element",
				tagName: a,
				properties: {
					...J(o),
					id: "footnote-label"
				},
				children: [{
					type: "text",
					value: i
				}]
			},
			{
				type: "text",
				value: "\n"
			},
			{
				type: "element",
				tagName: "ol",
				properties: {},
				children: e.wrap(s, !0)
			},
			{
				type: "text",
				value: "\n"
			}
		]
	};
}
// node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/state.js
var $t = {}.hasOwnProperty, en = {};
function tn(e, t) {
	let n = t || en, r = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Map(), a = {
		all: c,
		applyData: rn,
		definitionById: r,
		footnoteById: i,
		footnoteCounts: /* @__PURE__ */ new Map(),
		footnoteOrder: [],
		handlers: {
			...Ht,
			...n.handlers
		},
		one: o,
		options: n,
		patch: nn,
		wrap: on
	};
	return s(e, function(e) {
		if (e.type === "definition" || e.type === "footnoteDefinition") {
			let t = e.type === "definition" ? r : i, n = String(e.identifier).toUpperCase();
			t.has(n) || t.set(n, e);
		}
	}), a;
	function o(e, t) {
		let n = e.type, r = a.handlers[n];
		if ($t.call(a.handlers, n) && r) return r(a, e, t);
		if (a.options.passThrough && a.options.passThrough.includes(n)) {
			if ("children" in e) {
				let { children: t, ...n } = e, r = J(n);
				return r.children = a.all(e), r;
			}
			return J(e);
		}
		return (a.options.unknownHandler || an)(a, e, t);
	}
	function c(e) {
		let t = [];
		if ("children" in e) {
			let n = e.children, r = -1;
			for (; ++r < n.length;) {
				let i = a.one(n[r], e);
				if (i) {
					if (r && n[r - 1].type === "break" && (!Array.isArray(i) && i.type === "text" && (i.value = sn(i.value)), !Array.isArray(i) && i.type === "element")) {
						let e = i.children[0];
						e && e.type === "text" && (e.value = sn(e.value));
					}
					Array.isArray(i) ? t.push(...i) : t.push(i);
				}
			}
		}
		return t;
	}
}
function nn(e, t) {
	e.position && (t.position = ze(e));
}
function rn(e, t) {
	let n = t;
	if (e && e.data) {
		let t = e.data.hName, r = e.data.hChildren, i = e.data.hProperties;
		typeof t == "string" && (n.type === "element" ? n.tagName = t : n = {
			type: "element",
			tagName: t,
			properties: {},
			children: "children" in n ? n.children : [n]
		}), n.type === "element" && i && Object.assign(n.properties, J(i)), "children" in n && n.children && r != null && (n.children = r);
	}
	return n;
}
function an(e, t) {
	let n = t.data || {}, r = "value" in t && !($t.call(n, "hProperties") || $t.call(n, "hChildren")) ? {
		type: "text",
		value: t.value
	} : {
		type: "element",
		tagName: "div",
		properties: {},
		children: e.all(t)
	};
	return e.patch(t, r), e.applyData(t, r);
}
function on(e, t) {
	let n = [], r = -1;
	for (t && n.push({
		type: "text",
		value: "\n"
	}); ++r < e.length;) r && n.push({
		type: "text",
		value: "\n"
	}), n.push(e[r]);
	return t && e.length > 0 && n.push({
		type: "text",
		value: "\n"
	}), n;
}
function sn(e) {
	let t = 0, n = e.charCodeAt(t);
	for (; n === 9 || n === 32;) t++, n = e.charCodeAt(t);
	return e.slice(t);
}
// node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/index.js
function cn(e, t) {
	let n = tn(e, t), r = n.one(e, void 0), i = Qt(n), a = Array.isArray(r) ? {
		type: "root",
		children: r
	} : r || {
		type: "root",
		children: []
	};
	return i && ("children" in a, a.children.push({
		type: "text",
		value: "\n"
	}, i)), a;
}
// node_modules/.bun/remark-rehype@11.1.2/node_modules/remark-rehype/lib/index.js
function ln(e, t) {
	return e && "run" in e ? async function(n, r) {
		let i = cn(n, {
			file: r,
			...t
		});
		await e.run(i, r);
	} : function(n, r) {
		return cn(n, {
			file: r,
			...e || t
		});
	};
}
// node_modules/.bun/bail@2.0.2/node_modules/bail/index.js
function un(e) {
	if (e) throw e;
}
// node_modules/.bun/is-plain-obj@4.1.0/node_modules/is-plain-obj/index.js
var dn = /* @__PURE__ */ e((/* @__PURE__ */ n(((e, t) => {
	var n = Object.prototype.hasOwnProperty, r = Object.prototype.toString, i = Object.defineProperty, a = Object.getOwnPropertyDescriptor, o = function(e) {
		return typeof Array.isArray == "function" ? Array.isArray(e) : r.call(e) === "[object Array]";
	}, s = function(e) {
		if (!e || r.call(e) !== "[object Object]") return !1;
		var t = n.call(e, "constructor"), i = e.constructor && e.constructor.prototype && n.call(e.constructor.prototype, "isPrototypeOf");
		if (e.constructor && !t && !i) return !1;
		for (var a in e);
		return a === void 0 || n.call(e, a);
	}, c = function(e, t) {
		i && t.name === "__proto__" ? i(e, t.name, {
			enumerable: !0,
			configurable: !0,
			value: t.newValue,
			writable: !0
		}) : e[t.name] = t.newValue;
	}, l = function(e, t) {
		if (t === "__proto__") {
			if (!n.call(e, t)) return;
			if (a) return a(e, t).value;
		}
		return e[t];
	};
	t.exports = function e() {
		var t, n, r, i, a, u, d = arguments[0], f = 1, p = arguments.length, m = !1;
		for (typeof d == "boolean" && (m = d, d = arguments[1] || {}, f = 2), (d == null || typeof d != "object" && typeof d != "function") && (d = {}); f < p; ++f) if (t = arguments[f], t != null) for (n in t) r = l(d, n), i = l(t, n), d !== i && (m && i && (s(i) || (a = o(i))) ? (a ? (a = !1, u = r && o(r) ? r : []) : u = r && s(r) ? r : {}, c(d, {
			name: n,
			newValue: e(m, u, i)
		})) : i !== void 0 && c(d, {
			name: n,
			newValue: i
		}));
		return d;
	};
})))(), 1);
function fn(e) {
	if (typeof e != "object" || !e) return !1;
	let t = Object.getPrototypeOf(e);
	return (t === null || t === Object.prototype || Object.getPrototypeOf(t) === null) && !(Symbol.toStringTag in e) && !(Symbol.iterator in e);
}
// node_modules/.bun/trough@2.2.0/node_modules/trough/lib/index.js
function pn() {
	let e = [], t = {
		run: n,
		use: r
	};
	return t;
	function n(...t) {
		let n = -1, r = t.pop();
		if (typeof r != "function") throw TypeError("Expected function as last argument, not " + r);
		i(null, ...t);
		function i(a, ...o) {
			let s = e[++n], c = -1;
			if (a) r(a);
			else {
				for (; ++c < t.length;) (o[c] === null || o[c] === void 0) && (o[c] = t[c]);
				t = o, s ? mn(s, i)(...o) : r(null, ...o);
			}
		}
	}
	function r(n) {
		if (typeof n != "function") throw TypeError("Expected `middelware` to be a function, not " + n);
		return e.push(n), t;
	}
}
function mn(e, t) {
	let n;
	return r;
	function r(...t) {
		let r = e.length > t.length, o;
		r && t.push(i);
		try {
			o = e.apply(this, t);
		} catch (e) {
			let t = e;
			if (r && n) throw t;
			return i(t);
		}
		r || (o && o.then && typeof o.then == "function" ? o.then(a, i) : o instanceof Error ? i(o) : a(o));
	}
	function i(e, ...r) {
		n || (n = !0, t(e, ...r));
	}
	function a(e) {
		i(null, e);
	}
}
// node_modules/.bun/vfile@6.0.3/node_modules/vfile/lib/minpath.browser.js
var Y = {
	basename: hn,
	dirname: gn,
	extname: _n,
	join: vn,
	sep: "/"
};
function hn(e, t) {
	if (t !== void 0 && typeof t != "string") throw TypeError("\"ext\" argument must be a string");
	X(e);
	let n = 0, r = -1, i = e.length, a;
	if (t === void 0 || t.length === 0 || t.length > e.length) {
		for (; i--;) if (e.codePointAt(i) === 47) {
			if (a) {
				n = i + 1;
				break;
			}
		} else r < 0 && (a = !0, r = i + 1);
		return r < 0 ? "" : e.slice(n, r);
	}
	if (t === e) return "";
	let o = -1, s = t.length - 1;
	for (; i--;) if (e.codePointAt(i) === 47) {
		if (a) {
			n = i + 1;
			break;
		}
	} else o < 0 && (a = !0, o = i + 1), s > -1 && (e.codePointAt(i) === t.codePointAt(s--) ? s < 0 && (r = i) : (s = -1, r = o));
	return n === r ? r = o : r < 0 && (r = e.length), e.slice(n, r);
}
function gn(e) {
	if (X(e), e.length === 0) return ".";
	let t = -1, n = e.length, r;
	for (; --n;) if (e.codePointAt(n) === 47) {
		if (r) {
			t = n;
			break;
		}
	} else r ||= !0;
	return t < 0 ? e.codePointAt(0) === 47 ? "/" : "." : t === 1 && e.codePointAt(0) === 47 ? "//" : e.slice(0, t);
}
function _n(e) {
	X(e);
	let t = e.length, n = -1, r = 0, i = -1, a = 0, o;
	for (; t--;) {
		let s = e.codePointAt(t);
		if (s === 47) {
			if (o) {
				r = t + 1;
				break;
			}
		} else n < 0 && (o = !0, n = t + 1), s === 46 ? i < 0 ? i = t : a !== 1 && (a = 1) : i > -1 && (a = -1);
	}
	return i < 0 || n < 0 || a === 0 || a === 1 && i === n - 1 && i === r + 1 ? "" : e.slice(i, n);
}
function vn(...e) {
	let t = -1, n;
	for (; ++t < e.length;) X(e[t]), e[t] && (n = n === void 0 ? e[t] : n + "/" + e[t]);
	return n === void 0 ? "." : yn(n);
}
function yn(e) {
	X(e);
	let t = e.codePointAt(0) === 47, n = bn(e, !t);
	return n.length === 0 && !t && (n = "."), n.length > 0 && e.codePointAt(e.length - 1) === 47 && (n += "/"), t ? "/" + n : n;
}
function bn(e, t) {
	let n = "", r = 0, i = -1, a = 0, o = -1, s, c;
	for (; ++o <= e.length;) {
		if (o < e.length) s = e.codePointAt(o);
		else if (s === 47) break;
		else s = 47;
		if (s === 47) {
			if (i !== o - 1 && a !== 1) {
				if (i !== o - 1 && a === 2) {
					if (n.length < 2 || r !== 2 || n.codePointAt(n.length - 1) !== 46 || n.codePointAt(n.length - 2) !== 46) {
						if (n.length > 2) {
							if (c = n.lastIndexOf("/"), c !== n.length - 1) {
								c < 0 ? (n = "", r = 0) : (n = n.slice(0, c), r = n.length - 1 - n.lastIndexOf("/")), i = o, a = 0;
								continue;
							}
						} else if (n.length > 0) {
							n = "", r = 0, i = o, a = 0;
							continue;
						}
					}
					t && (n = n.length > 0 ? n + "/.." : "..", r = 2);
				} else n.length > 0 ? n += "/" + e.slice(i + 1, o) : n = e.slice(i + 1, o), r = o - i - 1;
			}
			i = o, a = 0;
		} else s === 46 && a > -1 ? a++ : a = -1;
	}
	return n;
}
function X(e) {
	if (typeof e != "string") throw TypeError("Path must be a string. Received " + JSON.stringify(e));
}
// node_modules/.bun/vfile@6.0.3/node_modules/vfile/lib/minproc.browser.js
var xn = { cwd: Sn };
function Sn() {
	return "/";
}
// node_modules/.bun/vfile@6.0.3/node_modules/vfile/lib/minurl.shared.js
function Cn(e) {
	return !!(typeof e == "object" && e && "href" in e && e.href && "protocol" in e && e.protocol && e.auth === void 0);
}
// node_modules/.bun/vfile@6.0.3/node_modules/vfile/lib/minurl.browser.js
function wn(e) {
	if (typeof e == "string") e = new URL(e);
	else if (!Cn(e)) {
		let t = /* @__PURE__ */ TypeError("The \"path\" argument must be of type string or an instance of URL. Received `" + e + "`");
		throw t.code = "ERR_INVALID_ARG_TYPE", t;
	}
	if (e.protocol !== "file:") {
		let e = /* @__PURE__ */ TypeError("The URL must be of scheme file");
		throw e.code = "ERR_INVALID_URL_SCHEME", e;
	}
	return Tn(e);
}
function Tn(e) {
	if (e.hostname !== "") {
		let e = /* @__PURE__ */ TypeError("File URL host must be \"localhost\" or empty on darwin");
		throw e.code = "ERR_INVALID_FILE_URL_HOST", e;
	}
	let t = e.pathname, n = -1;
	for (; ++n < t.length;) if (t.codePointAt(n) === 37 && t.codePointAt(n + 1) === 50) {
		let e = t.codePointAt(n + 2);
		if (e === 70 || e === 102) {
			let e = /* @__PURE__ */ TypeError("File URL path must not include encoded / characters");
			throw e.code = "ERR_INVALID_FILE_URL_PATH", e;
		}
	}
	return decodeURIComponent(t);
}
// node_modules/.bun/vfile@6.0.3/node_modules/vfile/lib/index.js
var En = [
	"history",
	"path",
	"basename",
	"stem",
	"extname",
	"dirname"
], Dn = class {
	constructor(e) {
		let t;
		t = e ? Cn(e) ? { path: e } : typeof e == "string" || An(e) ? { value: e } : e : {}, this.cwd = "cwd" in t ? "" : xn.cwd(), this.data = {}, this.history = [], this.messages = [], this.value, this.map, this.result, this.stored;
		let n = -1;
		for (; ++n < En.length;) {
			let e = En[n];
			e in t && t[e] !== void 0 && t[e] !== null && (this[e] = e === "history" ? [...t[e]] : t[e]);
		}
		let r;
		for (r in t) En.includes(r) || (this[r] = t[r]);
	}
	get basename() {
		return typeof this.path == "string" ? Y.basename(this.path) : void 0;
	}
	set basename(e) {
		On(e, "basename"), Z(e, "basename"), this.path = Y.join(this.dirname || "", e);
	}
	get dirname() {
		return typeof this.path == "string" ? Y.dirname(this.path) : void 0;
	}
	set dirname(e) {
		kn(this.basename, "dirname"), this.path = Y.join(e || "", this.basename);
	}
	get extname() {
		return typeof this.path == "string" ? Y.extname(this.path) : void 0;
	}
	set extname(e) {
		if (Z(e, "extname"), kn(this.dirname, "extname"), e) {
			if (e.codePointAt(0) !== 46) throw Error("`extname` must start with `.`");
			if (e.includes(".", 1)) throw Error("`extname` cannot contain multiple dots");
		}
		this.path = Y.join(this.dirname, this.stem + (e || ""));
	}
	get path() {
		return this.history[this.history.length - 1];
	}
	set path(e) {
		Cn(e) && (e = wn(e)), On(e, "path"), this.path !== e && this.history.push(e);
	}
	get stem() {
		return typeof this.path == "string" ? Y.basename(this.path, this.extname) : void 0;
	}
	set stem(e) {
		On(e, "stem"), Z(e, "stem"), this.path = Y.join(this.dirname || "", e + (this.extname || ""));
	}
	fail(e, t, n) {
		let r = this.message(e, t, n);
		throw r.fatal = !0, r;
	}
	info(e, t, n) {
		let r = this.message(e, t, n);
		return r.fatal = void 0, r;
	}
	message(e, t, n) {
		let r = new L(e, t, n);
		return this.path && (r.name = this.path + ":" + r.name, r.file = this.path), r.fatal = !1, this.messages.push(r), r;
	}
	toString(e) {
		return this.value === void 0 ? "" : typeof this.value == "string" ? this.value : new TextDecoder(e || void 0).decode(this.value);
	}
};
function Z(e, t) {
	if (e && e.includes(Y.sep)) throw Error("`" + t + "` cannot be a path: did not expect `" + Y.sep + "`");
}
function On(e, t) {
	if (!e) throw Error("`" + t + "` cannot be empty");
}
function kn(e, t) {
	if (!e) throw Error("Setting `" + t + "` requires `path` to be set too");
}
function An(e) {
	return !!(e && typeof e == "object" && "byteLength" in e && "byteOffset" in e);
}
// node_modules/.bun/unified@11.0.5/node_modules/unified/lib/callable-instance.js
var jn = (function(e) {
	let t = this.constructor.prototype, n = t[e], r = function() {
		return n.apply(r, arguments);
	};
	return Object.setPrototypeOf(r, t), r;
}), Mn = {}.hasOwnProperty, Nn = new class e extends jn {
	constructor() {
		super("copy"), this.Compiler = void 0, this.Parser = void 0, this.attachers = [], this.compiler = void 0, this.freezeIndex = -1, this.frozen = void 0, this.namespace = {}, this.parser = void 0, this.transformers = pn();
	}
	copy() {
		let t = new e(), n = -1;
		for (; ++n < this.attachers.length;) {
			let e = this.attachers[n];
			t.use(...e);
		}
		return t.data((0, dn.default)(!0, {}, this.namespace)), t;
	}
	data(e, t) {
		return typeof e == "string" ? arguments.length === 2 ? (In("data", this.frozen), this.namespace[e] = t, this) : Mn.call(this.namespace, e) && this.namespace[e] || void 0 : e ? (In("data", this.frozen), this.namespace = e, this) : this.namespace;
	}
	freeze() {
		if (this.frozen) return this;
		let e = this;
		for (; ++this.freezeIndex < this.attachers.length;) {
			let [t, ...n] = this.attachers[this.freezeIndex];
			if (n[0] === !1) continue;
			n[0] === !0 && (n[0] = void 0);
			let r = t.call(e, ...n);
			typeof r == "function" && this.transformers.use(r);
		}
		return this.frozen = !0, this.freezeIndex = Infinity, this;
	}
	parse(e) {
		this.freeze();
		let t = Q(e), n = this.parser || this.Parser;
		return Pn("parse", n), n(String(t), t);
	}
	process(e, t) {
		let n = this;
		return this.freeze(), Pn("process", this.parser || this.Parser), Fn("process", this.compiler || this.Compiler), t ? r(void 0, t) : new Promise(r);
		function r(r, i) {
			let a = Q(e), o = n.parse(a);
			n.run(o, a, function(e, t, r) {
				if (e || !t || !r) return s(e);
				let i = t, a = n.stringify(i, r);
				Bn(a) ? r.value = a : r.result = a, s(e, r);
			});
			function s(e, n) {
				e || !n ? i(e) : r ? r(n) : t(void 0, n);
			}
		}
	}
	processSync(e) {
		let t = !1, n;
		return this.freeze(), Pn("processSync", this.parser || this.Parser), Fn("processSync", this.compiler || this.Compiler), this.process(e, r), Rn("processSync", "process", t), n;
		function r(e, r) {
			t = !0, un(e), n = r;
		}
	}
	run(e, t, n) {
		Ln(e), this.freeze();
		let r = this.transformers;
		return !n && typeof t == "function" && (n = t, t = void 0), n ? i(void 0, n) : new Promise(i);
		function i(i, a) {
			let o = Q(t);
			r.run(e, o, s);
			function s(t, r, o) {
				let s = r || e;
				t ? a(t) : i ? i(s) : n(void 0, s, o);
			}
		}
	}
	runSync(e, t) {
		let n = !1, r;
		return this.run(e, t, i), Rn("runSync", "run", n), r;
		function i(e, t) {
			un(e), r = t, n = !0;
		}
	}
	stringify(e, t) {
		this.freeze();
		let n = Q(t), r = this.compiler || this.Compiler;
		return Fn("stringify", r), Ln(e), r(e, n);
	}
	use(e, ...t) {
		let n = this.attachers, r = this.namespace;
		if (In("use", this.frozen), e != null) {
			if (typeof e == "function") s(e, t);
			else if (typeof e == "object") Array.isArray(e) ? o(e) : a(e);
			else throw TypeError("Expected usable value, not `" + e + "`");
		}
		return this;
		function i(e) {
			if (typeof e == "function") s(e, []);
			else if (typeof e == "object") {
				if (Array.isArray(e)) {
					let [t, ...n] = e;
					s(t, n);
				} else a(e);
			} else throw TypeError("Expected usable value, not `" + e + "`");
		}
		function a(e) {
			if (!("plugins" in e) && !("settings" in e)) throw Error("Expected usable value but received an empty preset, which is probably a mistake: presets typically come with `plugins` and sometimes with `settings`, but this has neither");
			o(e.plugins), e.settings && (r.settings = (0, dn.default)(!0, r.settings, e.settings));
		}
		function o(e) {
			let t = -1;
			if (e != null) {
				if (Array.isArray(e)) for (; ++t < e.length;) {
					let n = e[t];
					i(n);
				}
				else throw TypeError("Expected a list of plugins, not `" + e + "`");
			}
		}
		function s(e, t) {
			let r = -1, i = -1;
			for (; ++r < n.length;) if (n[r][0] === e) {
				i = r;
				break;
			}
			if (i === -1) n.push([e, ...t]);
			else if (t.length > 0) {
				let [r, ...a] = t, o = n[i][1];
				fn(o) && fn(r) && (r = (0, dn.default)(!0, o, r)), n[i] = [
					e,
					r,
					...a
				];
			}
		}
	}
}().freeze();
function Pn(e, t) {
	if (typeof t != "function") throw TypeError("Cannot `" + e + "` without `parser`");
}
function Fn(e, t) {
	if (typeof t != "function") throw TypeError("Cannot `" + e + "` without `compiler`");
}
function In(e, t) {
	if (t) throw Error("Cannot call `" + e + "` on a frozen processor.\nCreate a new processor first, by calling it: use `processor()` instead of `processor`.");
}
function Ln(e) {
	if (!fn(e) || typeof e.type != "string") throw TypeError("Expected node, got `" + e + "`");
}
function Rn(e, t, n) {
	if (!n) throw Error("`" + e + "` finished async. Use `" + t + "` instead");
}
function Q(e) {
	return zn(e) ? e : new Dn(e);
}
function zn(e) {
	return !!(e && typeof e == "object" && "message" in e && "messages" in e);
}
function Bn(e) {
	return typeof e == "string" || Vn(e);
}
function Vn(e) {
	return !!(e && typeof e == "object" && "byteLength" in e && "byteOffset" in e);
}
// node_modules/.bun/react-markdown@10.1.0+26a211c426f3f87c/node_modules/react-markdown/lib/index.js
var Hn = [], Un = { allowDangerousHtml: !0 }, Wn = /^(https?|ircs?|mailto|xmpp)$/i, Gn = [
	{
		from: "astPlugins",
		id: "remove-buggy-html-in-markdown-parser"
	},
	{
		from: "allowDangerousHtml",
		id: "remove-buggy-html-in-markdown-parser"
	},
	{
		from: "allowNode",
		id: "replace-allownode-allowedtypes-and-disallowedtypes",
		to: "allowElement"
	},
	{
		from: "allowedTypes",
		id: "replace-allownode-allowedtypes-and-disallowedtypes",
		to: "allowedElements"
	},
	{
		from: "className",
		id: "remove-classname"
	},
	{
		from: "disallowedTypes",
		id: "replace-allownode-allowedtypes-and-disallowedtypes",
		to: "disallowedElements"
	},
	{
		from: "escapeHtml",
		id: "remove-buggy-html-in-markdown-parser"
	},
	{
		from: "includeElementIndex",
		id: "#remove-includeelementindex"
	},
	{
		from: "includeNodeIndex",
		id: "change-includenodeindex-to-includeelementindex"
	},
	{
		from: "linkTarget",
		id: "remove-linktarget"
	},
	{
		from: "plugins",
		id: "change-plugins-to-remarkplugins",
		to: "remarkPlugins"
	},
	{
		from: "rawSourcePos",
		id: "#remove-rawsourcepos"
	},
	{
		from: "renderers",
		id: "change-renderers-to-components",
		to: "components"
	},
	{
		from: "source",
		id: "change-source-to-children",
		to: "children"
	},
	{
		from: "sourcePos",
		id: "#remove-sourcepos"
	},
	{
		from: "transformImageUri",
		id: "#add-urltransform",
		to: "urlTransform"
	},
	{
		from: "transformLinkUri",
		id: "#add-urltransform",
		to: "urlTransform"
	}
];
function Kn(e) {
	let t = qn(e), n = Jn(e);
	return Yn(t.runSync(t.parse(n), n), e);
}
function qn(e) {
	let t = e.rehypePlugins || Hn, n = e.remarkPlugins || Hn, r = e.remarkRehypeOptions ? {
		...e.remarkRehypeOptions,
		...Un
	} : Un;
	return Nn().use(dt).use(n).use(ln, r).use(t);
}
function Jn(e) {
	let t = e.children || "", n = new Dn();
	return typeof t == "string" ? n.value = t : "" + t, n;
}
function Yn(e, t) {
	let n = t.allowedElements, r = t.allowElement, i = t.components, a = t.disallowedElements, o = t.skipHtml, c = t.unwrapDisallowed, l = t.urlTransform || Xn;
	for (let e of Gn) Object.hasOwn(t, e.from) && "" + e.from + (e.to ? "use `" + e.to + "` instead" : "remove it") + e.id;
	return s(e, u), Ke(e, {
		Fragment: y,
		components: i,
		ignoreInvalidStyle: !0,
		jsx: b,
		jsxs: x,
		passKeys: !0,
		passNode: !0
	});
	function u(e, t, i) {
		if (e.type === "raw" && i && typeof t == "number") return o ? i.children.splice(t, 1) : i.children[t] = {
			type: "text",
			value: e.value
		}, t;
		if (e.type === "element") {
			let t;
			for (t in H) if (Object.hasOwn(H, t) && Object.hasOwn(e.properties, t)) {
				let n = e.properties[t], r = H[t];
				(r === null || r.includes(e.tagName)) && (e.properties[t] = l(String(n || ""), t, e));
			}
		}
		if (e.type === "element") {
			let o = n ? !n.includes(e.tagName) : a ? a.includes(e.tagName) : !1;
			if (!o && r && typeof t == "number" && (o = !r(e, t, i)), o && i && typeof t == "number") return c && e.children ? i.children.splice(t, 1, ...e.children) : i.children.splice(t, 1), t;
		}
	}
}
function Xn(e) {
	let t = e.indexOf(":"), n = e.indexOf("?"), r = e.indexOf("#"), i = e.indexOf("/");
	return t === -1 || i !== -1 && t > i || n !== -1 && t > n || r !== -1 && t > r || Wn.test(e.slice(0, t)) ? e : "";
}
// extensions/pstdio-planner/src/timeline/view/instruction-target.ts
function Zn(e, t, n) {
	if (/^[a-z]+:|^\/\/|^#/i.test(e)) return;
	let r = e.match(/(?:^|\/)([a-z][a-z0-9]*-\d+)(?:\/|$)/i)?.[1]?.toLowerCase();
	return r ? n.find((e) => e.shorthand.toLowerCase() === r)?.target : t.target;
}
// extensions/pstdio-planner/src/timeline/view/instruction-navigation.tsx
var Qn = c(void 0);
function $n(e) {
	let { row: t, plan: n, onOpen: r, children: i } = e;
	return /* @__PURE__ */ b(Qn.Provider, {
		value: (e) => {
			let i = Zn(e, t, n.sections.flatMap(({ rows: e }) => e));
			if (i) return () => r(i);
		},
		children: i
	});
}
// extensions/pstdio-planner/src/timeline/view/instructions.tsx
function er(e) {
	let { text: t } = e, n = l(Qn);
	return /* @__PURE__ */ b(p, {
		textStyle: "label/S/regular",
		css: {
			"& p, & ul, & ol": { marginBottom: "sm" },
			"& ul, & ol": { paddingLeft: "md" },
			"& h1, & h2, & h3": {
				fontWeight: "semibold",
				marginBottom: "sm"
			}
		},
		children: /* @__PURE__ */ b(Kn, {
			components: { a: ({ href: e, children: t }) => {
				let r = e && n?.(e);
				return r ? /* @__PURE__ */ b(v.button, {
					type: "button",
					onClick: r,
					color: "blue.fg",
					textDecoration: "underline",
					title: "Open ticket with attachment",
					children: t
				}) : e && !/^[a-z]+:|^\/\//i.test(e) ? /* @__PURE__ */ b(v.span, { children: t }) : /* @__PURE__ */ b(v.a, {
					href: e,
					target: "_blank",
					rel: "noopener noreferrer",
					color: "blue.fg",
					textDecoration: "underline",
					children: t
				});
			} },
			children: t
		})
	});
}
// extensions/pstdio-planner/src/timeline/view/review-question-prompt.ts
var tr = (e, t) => `${e}:${t.id}`, $ = (e) => e.input.kind === "text" ? [] : e.input.options.map((e, t) => ({
	...e,
	label: `${t + 1}. ${e.label}`
})), nr = (e, t) => ({ questions: t.map((t) => ({
	id: tr(e, t),
	question: t.label,
	required: t.required,
	multiple: t.input.kind === "multiple-choice",
	allowCustomAnswer: t.input.kind === "text",
	options: $(t).map(({ label: e }) => ({ label: e }))
})) }), rr = (e, t, n) => {
	let r = {}, i = {};
	if (!n || !("answers" in n)) return {
		selected: r,
		custom: i
	};
	for (let a of t) {
		let t = n.answers[a.id];
		if (t === void 0) continue;
		let o = tr(e, a);
		if (a.input.kind === "text") i[o] = String(t);
		else {
			let e = Array.isArray(t) ? t : [t];
			r[o] = $(a).filter(({ id: t }) => e.includes(t)).map(({ label: e }) => e);
		}
	}
	return {
		selected: r,
		custom: i
	};
}, ir = (e, t) => Object.fromEntries(e.flatMap((e, n) => {
	let r = t[n] ?? [];
	if (r.length === 0) return [];
	if (e.input.kind === "text") return [[e.id, r[0]]];
	let i = $(e), a = r.map((e) => i.find((t) => t.label === e)?.id ?? e);
	return [[e.id, e.input.kind === "multiple-choice" ? a : a[0]]];
}));
// extensions/pstdio-planner/src/timeline/view/request-form.tsx
function ar(e) {
	let { request: t, onAnswer: n, onOpenChat: i } = e, a = t.request.kind === "decision" ? t.request.questions : [], [o] = f(() => nr(t.id, a)), s = ne(o), [c] = f(() => rr(t.id, a, t.outcome?.kind === "answered" ? t.outcome.response : void 0)), l = d(s.restore).current;
	u(() => l(c.selected, c.custom), [l, c]);
	let [p, v] = f(), [y, S] = f(), C = async (e, t) => {
		v(e), S(void 0);
		try {
			await t();
		} catch (e) {
			S(e instanceof Error ? e.message : String(e));
		} finally {
			v(void 0);
		}
	}, re = () => t.request.kind === "task" ? { confirmed: !0 } : { answers: ir(a, s.buildAnswers()) }, ie = t.state === "answered" ? "Update answer" : "Submit answer";
	return /* @__PURE__ */ x(g, {
		gap: "sm",
		p: "sm",
		bg: "bg.subtle",
		borderRadius: "md",
		children: [
			/* @__PURE__ */ b(_, {
				textStyle: "label/M/medium",
				children: t.title
			}),
			/* @__PURE__ */ b(er, { text: t.instructions }),
			t.state === "cancelled" ? /* @__PURE__ */ b(_, {
				color: "fg.muted",
				children: t.outcomeText
			}) : null,
			t.state === "answered" ? /* @__PURE__ */ x(g, {
				gap: "xs",
				children: [/* @__PURE__ */ b(_, {
					color: "green.fg",
					textStyle: "label/S/medium",
					children: "Answered"
				}), t.request.kind === "task" ? /* @__PURE__ */ b(_, {
					textStyle: "label/S/regular",
					children: t.outcomeText
				}) : null]
			}) : null,
			t.state === "open" || t.state === "answered" && t.request.kind === "decision" ? /* @__PURE__ */ x(g, {
				gap: "sm",
				children: [a.length ? /* @__PURE__ */ b(te, {
					isEditable: p === void 0,
					questionPrompt: o,
					selectedOptionsByQuestion: s.selectedOptionsByQuestion,
					customAnswersByQuestion: s.customAnswersByQuestion,
					onToggleOption: s.toggleOption,
					onToggleOther: s.toggleOther,
					onCustomAnswerChange: s.setCustomAnswer
				}) : null, /* @__PURE__ */ x(ee, {
					gap: "xs",
					wrap: "wrap",
					children: [/* @__PURE__ */ b(m, {
						size: "sm",
						loading: p === "answer",
						disabled: p !== void 0 || s.hasMissingRequiredAnswer,
						onClick: () => void C("answer", () => n(t.id, re())),
						children: t.request.kind === "task" ? "Confirm completed" : ie
					}), /* @__PURE__ */ x(m, {
						size: "sm",
						variant: "outline",
						loading: p === "chat",
						disabled: p !== void 0,
						onClick: () => void C("chat", () => i(t.id)),
						children: [/* @__PURE__ */ b(h, { as: r }), "Open session"]
					})]
				})]
			}) : null,
			y ? /* @__PURE__ */ b(_, {
				role: "alert",
				color: "fg.error",
				children: y
			}) : null
		]
	});
}
// extensions/pstdio-planner/src/timeline/view/requests-panel.tsx
function or(e) {
	let { row: t, onAnswer: n, onOpenChat: r } = e, i = [...t.requests].sort((e, t) => Number(e.state !== "open") - Number(t.state !== "open"));
	return /* @__PURE__ */ x(g, {
		gap: "sm",
		children: [
			/* @__PURE__ */ b(_, {
				textStyle: "label/S/medium",
				color: "fg.muted",
				children: "NEEDS ATTENTION"
			}),
			t.requestErrors.map((e) => /* @__PURE__ */ x(_, {
				role: "alert",
				color: "fg.error",
				children: [e, " Restore the request and its answer from a known-good backup with help from your project maintainer, then reopen this ticket. Work stays paused until the record is readable."]
			}, e)),
			i.map((e) => /* @__PURE__ */ b(ar, {
				request: e,
				onAnswer: n,
				onOpenChat: r
			}, `${e.id}:${JSON.stringify(e.outcome)}`)),
			!t.requests.length && !t.requestErrors.length ? /* @__PURE__ */ b(_, {
				textStyle: "label/S/regular",
				color: "fg.muted",
				children: "Nothing needs attention."
			}) : null
		]
	});
}
export { er as n, $n as r, or as t };
