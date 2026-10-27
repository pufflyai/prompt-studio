// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, t } from "./assembly-layout-BE5FCzRo.ts";
import { n, t as r } from "./landing-tool-demo-AYY5tVVR.ts";
import { createContext as i, useContext as a } from "react";
import { defineSlotRecipe as o, useSlotRecipe as s } from "@chakra-ui/react";
// clients/landing-page/src/theme/recipes/landing.ts
var c = o({
	slots: /* @__PURE__ */ "root.window.titlebar.windowControls.windowControl.actionMenuButton.mobileTitlebar.sidebar.sidebarScroll.sidebarRows.sidebarHeading.sidebarFooter.status.copyright.releaseBadge.body.main.hero.heroLayout.cardSpace.heroCopy.download.downloadDescription.downloadPlatforms.siteTabs.siteTab.siteTabIcon.siteTabLabel".split("."),
	base: {
		root: {
			height: "100dvh",
			position: "relative",
			overflow: "hidden",
			bg: "bg.subtle"
		},
		window: {
			display: "flex",
			flexDirection: "column",
			height: "full",
			width: "full",
			position: "relative",
			bg: "bg.subtle",
			color: "fg",
			overflow: "hidden"
		},
		titlebar: {
			height: "11",
			flexShrink: 0,
			gap: "xs",
			px: "compact",
			display: {
				base: "none",
				lg: "flex"
			},
			alignItems: "center"
		},
		windowControls: {
			display: "flex",
			alignItems: "center",
			gap: "xs",
			px: "sm",
			flexShrink: 0
		},
		actionMenuButton: {
			marginInlineStart: "auto",
			flexShrink: 0
		},
		windowControl: {
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			width: "icon-2xs",
			height: "icon-2xs",
			borderRadius: "full",
			color: "blackAlpha.700",
			cursor: "pointer",
			"& svg": {
				width: "2",
				height: "2",
				visibility: "hidden"
			},
			"&[data-control=close]:not(:disabled)": { bg: "windowControl.close" },
			"&[data-control=minimize]:not(:disabled)": { bg: "windowControl.minimize" },
			"&[data-control=zoom]": { bg: "windowControl.zoom" },
			_groupHover: { "&:not(:disabled) svg": { visibility: "visible" } },
			_focusVisible: {
				outline: "2px solid",
				outlineColor: "fg",
				outlineOffset: "2px",
				"& svg": { visibility: "visible" }
			},
			_disabled: {
				bg: "bg.muted",
				cursor: "not-allowed",
				"& svg": { visibility: "hidden" }
			}
		},
		mobileTitlebar: {
			height: "mobile-titlebar",
			flexShrink: 0,
			px: "sm",
			display: {
				base: "flex",
				lg: "none"
			},
			alignItems: "center",
			justifyContent: "space-between"
		},
		sidebar: {
			display: "flex",
			flexDirection: "column",
			layerStyle: "panel",
			height: "full",
			width: "full",
			flexShrink: 0,
			gap: "2xs",
			px: "xs",
			py: "xs",
			bg: "bg.subtle"
		},
		sidebarScroll: {
			flex: 1,
			minHeight: 0,
			width: "full"
		},
		sidebarRows: {
			display: "flex",
			flexDirection: "column",
			gap: "2xs"
		},
		sidebarHeading: {
			display: "flex",
			alignItems: "center",
			minHeight: "7",
			mt: "sm",
			px: "xs",
			textStyle: "label/XS",
			color: "fg.subtle",
			textTransform: "uppercase"
		},
		sidebarFooter: {
			display: "flex",
			flexDirection: "column",
			gap: "2xs",
			pt: "xs",
			borderTopWidth: "1px",
			borderColor: "border.subtle"
		},
		status: {
			minHeight: "7",
			flexShrink: 0,
			flexWrap: "wrap",
			gap: "xs",
			rowGap: "2xs",
			px: "xs",
			color: "fg.muted"
		},
		copyright: {
			textStyle: {
				base: "label/XS",
				md: "label/S/medium"
			},
			whiteSpace: "nowrap"
		},
		releaseBadge: {
			bg: "illustration.skill",
			color: "white"
		},
		body: {
			display: "flex",
			flex: 1,
			minHeight: 0,
			p: "panel-gap"
		},
		main: {
			flex: 1,
			minHeight: 0,
			minWidth: 0,
			position: "relative",
			overflow: "hidden",
			"&[aria-busy=true]": {
				opacity: .5,
				transition: "opacity 120ms ease 150ms"
			}
		},
		hero: {
			flex: 1,
			minHeight: 0,
			display: "flex",
			flexDirection: "column",
			layerStyle: "panel",
			bg: "bg",
			width: "full",
			height: "full",
			overflow: "hidden",
			containerType: "inline-size",
			containerName: "hero",
			"& > [data-part=root] > [data-part=viewport] > [data-part=content]": {
				display: "flex",
				flexDirection: "column",
				minHeight: "full"
			}
		},
		heroLayout: {
			position: "relative",
			pb: "24",
			flex: "1 0 auto",
			display: "grid",
			gridTemplateColumns: "minmax(0, 1fr)",
			alignItems: "start",
			minHeight: "full",
			width: "full",
			mx: "auto",
			[`@container hero (min-width: ${t / 16}rem)`]: {
				gridTemplateColumns: "30rem minmax(0, 1fr)",
				alignItems: "center",
				pb: "0"
			}
		},
		cardSpace: {
			position: "relative",
			alignSelf: "stretch",
			containerType: "size",
			containerName: "board-area",
			minHeight: "var(--assembly-min-height)",
			"--assembly-min-height": "32rem",
			"--assembly-horizontal-space": "32px",
			"--assembly-bottom-space": "96px",
			"--assembly-board-scale": e.narrow,
			[`@container hero (min-width: ${t / 16}rem)`]: {
				"--assembly-min-height": "36rem",
				"--assembly-horizontal-space": "48px",
				"--assembly-bottom-space": "0px",
				"--assembly-board-scale": e.wide
			}
		},
		heroCopy: {
			position: "relative",
			zIndex: 1,
			pointerEvents: "none",
			"& a, & button": { pointerEvents: "auto" },
			display: "flex",
			flexDirection: "column",
			width: "full",
			maxWidth: "2xl",
			mx: "auto",
			gap: "xl",
			px: {
				base: "lg",
				xl: "3xl"
			},
			py: {
				base: "xl",
				xl: "4xl"
			},
			[`@container hero (min-width: ${t / 16}rem)`]: {
				gap: "md",
				py: "lg"
			}
		},
		download: {
			display: "flex",
			flexDirection: "column",
			gap: "sm",
			alignItems: "start",
			width: "full"
		},
		downloadDescription: { minHeight: "12" },
		downloadPlatforms: {
			minHeight: "8",
			gap: "xs"
		},
		siteTabs: {
			gap: "2xs",
			flexShrink: 1,
			minWidth: 0,
			overflowX: "auto"
		},
		siteTab: {
			display: "flex",
			alignItems: "center",
			height: "7",
			px: "compact",
			gap: "xs",
			borderRadius: "xs",
			color: "fg.muted",
			flexShrink: 0,
			cursor: "pointer",
			focusVisibleRing: "outside",
			_hover: {
				bg: "bg.hover",
				color: "fg"
			},
			"&[aria-current=page]": {
				bg: "bg.hover",
				color: "fg"
			}
		},
		siteTabIcon: {
			boxSize: "icon-sm",
			flexShrink: 0,
			"& svg": {
				width: "full",
				height: "full"
			}
		},
		siteTabLabel: {
			fontFamily: "heading",
			textStyle: "label/S/medium",
			whiteSpace: "nowrap"
		}
	},
	variants: { windowed: { true: {
		root: { bg: "illustration.desktop" },
		window: {
			height: "calc(100dvh - 12rem)",
			width: "calc(100% - 15rem)",
			mx: "7.5rem",
			my: "6rem",
			borderRadius: "lg",
			boxShadow: "2xl"
		},
		titlebar: {
			cursor: "grab",
			_active: { cursor: "grabbing" }
		}
	} } }
}), l = {
	display: "flex",
	flexDirection: "column",
	gap: "sm",
	listStylePosition: "outside",
	ps: "lg"
}, u = {
	"--astro-code-foreground": "{colors.fg}",
	"--astro-code-background": "{colors.bg.muted}",
	"--astro-code-token-keyword": "{colors.fg.info}",
	"--astro-code-token-function": "{colors.fg.info}",
	"--astro-code-token-link": "{colors.fg.info}",
	"--astro-code-token-string": "{colors.fg.success}",
	"--astro-code-token-string-expression": "{colors.fg.success}",
	"--astro-code-token-constant": "{colors.fg.warning}",
	"--astro-code-token-parameter": "{colors.fg.warning}",
	"--astro-code-token-comment": "{colors.fg.muted}",
	"--astro-code-token-punctuation": "{colors.fg.muted}"
}, d = {
	"& img[data-art-tone=dark], & p:has(> img[data-art-tone=dark])": { display: "none" },
	_dark: {
		"& img[data-art-tone=light], & p:has(> img[data-art-tone=light])": { display: "none" },
		"& img[data-art-tone=dark], & p:has(> img[data-art-tone=dark])": { display: "block" }
	}
}, f = o({
	slots: [
		"column",
		"layout",
		"prose",
		"html",
		"outline",
		"outlineTitle",
		"outlineLink",
		"postMeta",
		"postAuthor",
		"postDetails",
		"postBanner",
		"postArtwork",
		"postListItem",
		"postSummary",
		"homeTopics"
	],
	base: {
		column: {
			layerStyle: "panel",
			bg: "bg",
			width: "full",
			minWidth: 0,
			height: "full",
			overflow: "hidden"
		},
		layout: {
			display: "flex",
			justifyContent: "center",
			width: "full"
		},
		prose: {
			display: "flex",
			flexDirection: "column",
			gap: "lg",
			flex: 1,
			minWidth: 0,
			maxWidth: "3xl",
			px: {
				base: "lg",
				md: "xl"
			},
			pt: "3xl",
			pb: "2xl",
			color: "fg",
			"& header": {
				display: "flex",
				flexDirection: "column",
				gap: "sm"
			},
			"& h1": { textStyle: {
				base: "heading/M",
				md: "heading/L"
			} },
			"& h2": {
				textStyle: "heading/S",
				pt: "md"
			},
			"& h3": { textStyle: "label/L/medium" },
			"& h4": { textStyle: "label/M/medium" },
			"& :is(h1, h2, h3, h4, h5, h6)": { scrollMarginTop: "lg" },
			"& h2 a, & h3 a": {
				color: "fg",
				_hover: { textDecoration: "underline" }
			},
			"& a[data-heading-link]": {
				display: "inline-block",
				ms: "sm",
				color: "fg.muted",
				textDecoration: "none",
				_after: { content: "\"#\"" },
				_hover: {
					color: "fg",
					textDecoration: "none"
				},
				_focusVisible: {
					outlineWidth: "2px",
					outlineStyle: "solid",
					outlineColor: "focusRing",
					outlineOffset: "2px"
				}
			},
			"& p": {
				textStyle: "paragraph/M/regular",
				color: "fg.muted"
			},
			"& em": {
				textStyle: "label/S/italic",
				color: "fg.muted"
			},
			"& ul": {
				...l,
				listStyleType: "disc"
			},
			"& ol": {
				...l,
				listStyleType: "decimal"
			},
			"& li": {
				textStyle: "paragraph/M/regular",
				color: "fg.muted"
			},
			"& li > :is(ul, ol)": { mt: "sm" },
			"& strong": {
				color: "fg",
				fontWeight: "medium"
			},
			"& :where(p, li, td, blockquote) a": {
				textDecoration: "underline",
				display: {
					base: "inline-block",
					lg: "inline"
				},
				minHeight: {
					base: "11",
					lg: "auto"
				},
				px: {
					base: "2xs",
					lg: 0
				},
				py: {
					base: "xs",
					lg: 0
				},
				mx: {
					base: "-2xs",
					lg: 0
				},
				maxWidth: "full",
				touchAction: "manipulation",
				_hover: { color: "fg" }
			},
			"& blockquote": {
				borderInlineStartWidth: "2px",
				borderColor: "border",
				ps: "md"
			},
			"& hr": { borderColor: "border" },
			"& :not(pre) > code": {
				textStyle: "mono/S",
				bg: "bg.muted",
				color: "fg",
				px: "2xs",
				borderRadius: "2xs"
			},
			"& pre": {
				textStyle: "mono/S",
				p: "md",
				borderRadius: "sm",
				overflowX: "auto",
				...u
			},
			"& table": {
				display: {
					base: "block",
					md: "table"
				},
				width: "full",
				overflowX: "auto",
				borderCollapse: "collapse"
			},
			"& :is(th, td)": {
				borderWidth: "1px",
				borderColor: "border",
				px: "sm",
				py: "xs",
				textAlign: "start"
			},
			"& th": {
				textStyle: "paragraph/M/medium",
				bg: "bg.subtle",
				color: "fg"
			},
			"& td": {
				textStyle: "paragraph/M/regular",
				color: "fg.muted",
				verticalAlign: "top"
			}
		},
		html: {
			display: "contents",
			...d
		},
		outline: {
			display: {
				base: "none",
				xl: "flex"
			},
			flexDirection: "column",
			width: "50",
			flexShrink: 0,
			position: "sticky",
			top: 0,
			alignSelf: "flex-start",
			pt: "14",
			pe: "xl"
		},
		outlineTitle: {
			textStyle: "label/S/medium",
			color: "fg",
			pb: "sm"
		},
		outlineLink: {
			textStyle: "label/S/regular",
			color: "fg.muted",
			ps: "sm",
			py: "2xs",
			borderInlineStartWidth: "2px",
			borderColor: "border",
			_hover: { color: "fg" },
			"&[aria-current=location]": {
				color: "fg",
				borderColor: "fg"
			}
		},
		postMeta: {
			display: "flex",
			flexDirection: {
				base: "column",
				md: "row"
			},
			alignItems: {
				base: "flex-start",
				md: "center"
			},
			flexWrap: "wrap",
			gap: {
				base: "xs",
				md: "md"
			},
			textStyle: "label/S/regular",
			color: "fg.muted"
		},
		postAuthor: {
			display: "inline-flex",
			alignItems: "center",
			gap: "xs"
		},
		postDetails: {
			display: "inline-flex",
			alignItems: "center",
			flexWrap: "wrap",
			gap: "xs"
		},
		postBanner: {
			display: "block",
			width: "full",
			height: "auto",
			borderRadius: "xs"
		},
		postArtwork: {
			display: "contents",
			...d
		},
		postListItem: {
			display: "flex",
			flexDirection: "column",
			gap: "md",
			p: "md",
			borderRadius: "xs",
			color: "fg",
			textDecoration: "none",
			transitionProperty: "transform, background-color",
			transitionDuration: "fast",
			transitionTimingFunction: "ease-out",
			transitionDelay: "fast",
			_hover: {
				transform: "scale(1.015)",
				bg: "bg.subtle",
				transitionDelay: "0s"
			},
			_focusVisible: {
				outlineWidth: "2px",
				outlineStyle: "solid",
				outlineColor: "focusRing",
				outlineOffset: "2px"
			},
			"& h2": { pt: 0 },
			"&[data-featured] h2": { textStyle: "heading/M" },
			"@media (prefers-reduced-motion: reduce)": {
				transition: "none",
				_hover: { transform: "none" }
			}
		},
		postSummary: {
			display: "flex",
			flexDirection: "column",
			gap: "xs",
			flex: 1,
			minWidth: 0
		},
		homeTopics: {
			display: "grid",
			gridTemplateColumns: {
				base: "1fr",
				md: "repeat(2, minmax(0, 1fr))"
			},
			columnGap: "xl",
			rowGap: "lg",
			"& > div": {
				display: "flex",
				flexDirection: "column",
				gap: "sm"
			},
			"& ul": {
				listStyleType: "none",
				ps: 0,
				gap: "xs"
			},
			"& li a": {
				display: {
					base: "flex",
					lg: "inline"
				},
				alignItems: "center",
				width: {
					base: "full",
					lg: "auto"
				},
				px: {
					base: "xs",
					lg: 0
				},
				mx: {
					base: "-xs",
					lg: 0
				},
				textStyle: "label/M/regular",
				color: "fg.muted",
				textDecoration: "none",
				_hover: { color: "fg" }
			}
		}
	}
}), p = i(null), m = () => a(p), h = (e) => {
	let { kind: t, children: n } = e, r = m();
	return r && !r.parts.includes(t) ? null : n;
}, g = (e = !1) => s({ recipe: c })({ windowed: e }), _ = () => s({ recipe: n })({ compact: !!m() }), v = () => s({ recipe: r })({ compact: !!m() }), y = () => s({ recipe: f })({});
export { p as a, v as i, g as n, h as o, _ as r, m as s, y as t };
