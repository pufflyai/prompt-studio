// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./chat-question-bubble-tyNUkJKt.ts";
import { t } from "./queued-follow-up-D4i5QouN.ts";
import { a as n, c as r, i, l as a, n as o, o as s, r as c, s as l, t as ee, u as te } from "./colors-T6pRrya6.ts";
import { n as u, t as d } from "./window-title-bar-hwilC3c8.ts";
import { createSystem as f, defaultConfig as p, defineConfig as m, defineLayerStyles as h, defineRecipe as g, defineSlotRecipe as _, defineTextStyles as ne } from "@chakra-ui/react";
import { alertAnatomy as re, colorPickerAnatomy as ie, dialogAnatomy as ae, drawerAnatomy as oe, fieldsetAnatomy as se, menuAnatomy as ce, numberInputAnatomy as v, popoverAnatomy as y, switchAnatomy as b, tabsAnatomy as x, tagAnatomy as S, timelineAnatomy as C, tooltipAnatomy as w } from "@chakra-ui/react/anatomy";
import { progressCircleSlotRecipe as T } from "@chakra-ui/react/theme";
// packages/ui/src/theme/global.ts
var E = {
	"@property --split-size": {
		syntax: "\"<length>\"",
		inherits: "true",
		initialValue: "0px"
	},
	"@keyframes text-chunk": {
		from: { opacity: 0 },
		to: { opacity: 1 }
	},
	"*::selection": {
		bg: {
			base: "bg.accent-secondary.blue-medium",
			_dark: "bg.accent-secondary.blue-medium"
		},
		color: { _dark: "fg.inverted" }
	},
	":root": {
		"--focus-border": "border.accent-light",
		"--separator-border": "transparent !important"
	},
	":root:has([data-window-title-bar])": { "--pstdio-toast-top-offset": "calc({sizes.window-title-bar} + {spacing.md})" },
	html: {
		height: "100%",
		width: "100%",
		overflow: "hidden"
	},
	hr: { borderColor: "border.subtle" },
	body: {
		height: "100%",
		width: "100%",
		fontFamily: "body",
		fontWeight: "regular",
		fontSize: "md",
		bg: "bg",
		color: "fg",
		borderColor: "border",
		overflow: "hidden"
	},
	"#root": {
		height: "100%",
		width: "100%",
		display: "flex"
	},
	".sash": { zIndex: "docked" },
	"@keyframes message-fade-in": {
		from: {
			opacity: 0,
			transform: "translateY(4px)"
		},
		to: {
			opacity: 1,
			transform: "translateY(0)"
		}
	},
	"@media (min-width: 2560px)": { html: { fontSize: "1.25rem" } },
	"@media (min-width: 3840px)": { html: { fontSize: "1.5rem" } }
}, D = {
	"tree-expand": { value: "160ms" },
	"tree-collapse": { value: "120ms" },
	"panel-open": { value: "180ms" },
	"panel-close": { value: "140ms" },
	"surface-enter": { value: "100ms" },
	"surface-exit": { value: "75ms" },
	"text-chunk": { value: "240ms" }
}, O = {
	enter: { value: "cubic-bezier(0.33, 1, 0.68, 1)" },
	exit: { value: "cubic-bezier(0.32, 0, 0.67, 0)" }
}, k = {
	px: "xs",
	py: "2xs",
	gap: "xs"
}, A = _({
	slots: re.keys(),
	base: {
		root: {
			...k,
			borderRadius: "xs",
			alignItems: "flex-start",
			minH: "0",
			minW: "0",
			maxW: "full",
			maxH: "alert-max-height",
			overflow: "hidden",
			"& [data-scope=scroll-area][data-part=scrollbar]": {
				color: "inherit",
				margin: "0",
				"--thumb-bg": "currentColor",
				"&:is(:hover, :active)": { "--thumb-bg": "currentColor" }
			},
			"& .chakra-button": {
				color: "inherit",
				bg: "transparent",
				maxWidth: "full",
				height: "auto",
				minHeight: "6",
				whiteSpace: "normal",
				overflowWrap: "anywhere",
				"&:not(:disabled, [data-disabled])": {
					_hover: { "&:not(:active, [data-active])": { bg: "currentColor/10" } },
					_focusVisible: {
						bg: "currentColor/10",
						outlineColor: "currentColor"
					},
					_active: { bg: "currentColor/20" }
				}
			}
		},
		indicator: { mt: "2xs" },
		content: {
			gap: "0",
			minWidth: "0",
			minHeight: "0",
			alignSelf: "stretch"
		},
		title: {
			textStyle: "label/M/medium",
			py: "0.5",
			overflowWrap: "anywhere",
			whiteSpace: "pre-wrap"
		},
		description: {
			textStyle: "paragraph/S/regular",
			overflowWrap: "anywhere",
			whiteSpace: "pre-wrap",
			"& pre": {
				whiteSpace: "pre-wrap",
				overflowWrap: "anywhere"
			}
		}
	},
	variants: {
		status: {
			info: {},
			success: {},
			warning: {},
			error: {},
			neutral: {}
		},
		variant: {
			subtle: {},
			surface: {},
			outline: {},
			solid: {}
		},
		size: {
			sm: { root: k },
			md: { root: k },
			lg: { root: k }
		}
	},
	compoundVariants: [
		{
			status: "info",
			variant: "subtle",
			css: {
				root: {
					bg: "bg.info",
					color: "fg.info"
				},
				indicator: { color: "fg.info" }
			}
		},
		{
			status: "success",
			variant: "subtle",
			css: {
				root: {
					bg: "bg.success",
					color: "fg.success"
				},
				indicator: { color: "fg.success" }
			}
		},
		{
			status: "warning",
			variant: "subtle",
			css: {
				root: {
					bg: "bg.warning",
					color: "fg.warning"
				},
				indicator: { color: "fg.warning" }
			}
		},
		{
			status: "error",
			variant: "subtle",
			css: {
				root: {
					bg: "bg.error",
					color: "fg.error"
				},
				indicator: { color: "fg.error" }
			}
		}
	]
}), j = {
	bg: {
		_light: "bg.muted",
		_dark: "bg.subtle"
	},
	color: "fg.muted",
	_hover: { bg: {
		_light: "bg.subtle",
		_dark: "bg.hover"
	} }
}, M = g({
	className: "chakra-badge",
	base: {
		display: "inline-flex",
		alignItems: "center",
		borderRadius: "pill",
		gap: "1",
		fontWeight: "medium",
		fontVariantNumeric: "tabular-nums",
		whiteSpace: "nowrap",
		userSelect: "none"
	},
	variants: {
		variant: {
			ticket: j,
			solid: {
				bg: "colorPalette.solid",
				color: "colorPalette.contrast"
			},
			subtle: {
				bg: "colorPalette.subtle",
				color: "colorPalette.fg"
			},
			number: {
				bg: "colorPalette.subtle",
				color: "colorPalette.fg",
				borderRadius: "2xs",
				justifyContent: "center"
			},
			chip: {
				bg: "bg.subtle",
				color: "fg.muted",
				borderWidth: "1px",
				borderColor: "border",
				borderRadius: "xs",
				fontWeight: "normal"
			},
			outline: {
				color: "colorPalette.fg",
				"--outline-shadow-legacy": "colors.colorPalette.muted",
				"--outline-shadow": "colors.colorPalette.border",
				shadow: "inset 0 0 0px 1px var(--shadow-color)",
				shadowColor: "var(--outline-shadow, var(--outline-shadow-legacy))"
			},
			plain: { color: "colorPalette.fg" }
		},
		size: {
			xs: {
				textStyle: "2xs",
				px: "1",
				minH: "4"
			},
			sm: {
				textStyle: "xs",
				px: "1.5",
				minH: "5"
			},
			md: {
				textStyle: "sm",
				px: "2",
				minH: "6"
			},
			lg: {
				textStyle: "sm",
				px: "2.5",
				minH: "7"
			}
		}
	},
	defaultVariants: {
		variant: "subtle",
		size: "sm"
	}
}), N = {
	color: "fg",
	bg: "transparent",
	borderRadius: "0",
	border: "none",
	borderRightWidth: "1px",
	borderRightStyle: "solid",
	borderRightColor: "border.subtle",
	_hover: { bg: "bg.hover" },
	_expanded: { bg: "bg.active" }
}, P = g({
	base: {
		borderRadius: "xs",
		transition: "all 0.1s ease-in-out",
		fontFamily: "label",
		fontWeight: "500",
		color: "fg",
		bg: "bg",
		borderColor: "border",
		_disabled: {
			opacity: 1,
			color: "fg.subtle",
			bg: "bg.muted",
			_hover: { bg: "bg.muted" }
		},
		_loading: {
			opacity: 1,
			color: "fg.subtle",
			bg: "bg.muted",
			_hover: { bg: "bg.muted" }
		}
	},
	variants: {
		variant: {
			"display-primary": {
				bg: "blacks.900",
				color: "fg.inverted",
				outline: "none",
				border: "none",
				_hover: { bg: "blacks.800" }
			},
			"display-outline": {
				bg: "transparent",
				color: "fg",
				border: "2px solid {fg}",
				_hover: { bg: "bg.hover" },
				_active: { bg: "bg.active" }
			},
			"display-ghost": {
				bg: "transparent",
				color: "fg",
				_hover: { bg: "bg.hover" },
				_active: { bg: "bg.active" }
			},
			"display-link": {
				bg: "transparent",
				color: "fg",
				border: "none",
				_hover: { textDecoration: "underline" },
				_active: { textDecoration: "underline" }
			},
			primary: {
				color: "fg.button.primary.default",
				bg: "bg.button.primary.default",
				border: "none",
				_hover: { bg: "bg.button.primary.hover" },
				_active: { bg: "bg.button.primary.pressed" }
			},
			destructive: {
				color: "blacks.50",
				bg: "red.600",
				border: "none",
				_hover: { "&:not(:active, [data-active])": { bg: "red.700" } },
				_active: { bg: "red.800" }
			},
			"destructive-ghost": {
				color: "fg.subtle",
				bg: "transparent",
				border: "none",
				"&:not(:disabled, [data-disabled])": {
					_hover: {
						color: "fg.error",
						bg: "bg.error"
					},
					_focusVisible: {
						color: "fg.error",
						bg: "bg.error"
					},
					_active: {
						color: "fg.error",
						bg: "bg.error"
					},
					_groupHover: {
						color: "fg.error",
						bg: "bg.error"
					}
				},
				_disabled: {
					color: "fg.subtle",
					bg: "transparent",
					_hover: { bg: "transparent" }
				}
			},
			outline: {
				color: "fg",
				bg: "bg",
				border: "border",
				borderColor: "border",
				_hover: { bg: "bg.hover" },
				_active: { bg: "bg.active" },
				_expanded: { bg: "bg.active" },
				_disabled: {
					opacity: 1,
					color: "fg.subtle",
					borderColor: "border"
				}
			},
			ghost: {
				color: "fg",
				bg: "transparent",
				border: "none",
				_hover: { bg: "bg.hover" },
				_active: { bg: "bg.active" },
				_expanded: { bg: "bg.active" },
				"&[aria-pressed=true]": {
					bg: "bg.active",
					_hover: { bg: "bg.active" }
				},
				_disabled: {
					bg: "transparent",
					_hover: { bg: "transparent" }
				}
			},
			"filter-segment": N,
			"filter-condition": {
				...N,
				color: "fg.muted"
			},
			"ghost-static": {
				color: "fg",
				bg: "transparent",
				border: "none",
				_hover: { bg: "transparent" },
				_active: { bg: "transparent" }
			},
			subtle: {
				color: "fg",
				bg: "bg.muted",
				border: "1px solid {border}",
				_hover: { bg: "bg.hover" },
				_active: { bg: "bg.active" },
				_expanded: { bg: "bg.active" },
				_disabled: {
					opacity: 1,
					color: "fg.subtle",
					bg: "bg.muted",
					borderColor: "border",
					_hover: { bg: "bg.muted" }
				}
			}
		},
		size: {
			"2xs": {
				px: "0.375rem",
				h: "1.5rem",
				minW: "1.5rem",
				textStyle: "label/XS",
				_icon: {
					width: "0.75rem",
					height: "0.75rem"
				}
			},
			xs: {
				px: "0.5rem",
				h: "1.75rem",
				minW: "1.75rem",
				textStyle: "label/XS",
				_icon: {
					width: "0.875rem",
					height: "0.875rem"
				}
			},
			"2xl": {
				px: "1.5rem",
				h: "3.5rem",
				textStyle: "label/L/medium"
			},
			lg: {
				px: "1rem",
				h: "3rem",
				textStyle: "label/M/medium"
			},
			md: { textStyle: "label/M/medium" },
			sm: {
				px: "0.5rem",
				h: "2rem",
				minW: "2rem",
				textStyle: "label/S/medium"
			}
		}
	},
	defaultVariants: {
		size: "sm",
		variant: "outline"
	}
}), F = _({
	slots: [
		"root",
		"control",
		"indicator",
		"label",
		"group"
	],
	base: { control: { borderRadius: "xs" } },
	variants: { size: { xs: {
		root: { gap: "2xs" },
		control: {
			boxSize: "3",
			borderRadius: "2xs"
		},
		indicator: { boxSize: "2.5" },
		label: { textStyle: "label/XS" }
	} } }
}), I = "border.accent-light", L = _({
	slots: ie.keys(),
	base: {
		control: {
			display: "flex",
			alignItems: "center",
			width: "full",
			minW: "0",
			h: "2rem",
			bg: "bg",
			color: "fg",
			border: "1px solid",
			borderColor: "border",
			borderRadius: "xs",
			overflow: "hidden",
			transition: "border-color 0.2s ease-in-out",
			outline: "none",
			boxShadow: "none",
			_hover: { borderColor: I },
			_active: { borderColor: I },
			_focusWithin: {
				borderColor: I,
				boxShadow: "none"
			},
			"&:is(:hover, [data-hover])": { borderColor: I },
			"&:is(:active, [data-active])": { borderColor: I },
			"& [data-scope=color-picker][data-part=trigger]": {
				border: "0",
				borderInlineStartWidth: "0",
				boxShadow: "none"
			}
		},
		channelInput: {
			h: "full",
			minW: "0",
			flex: "1",
			px: "sm",
			bg: "transparent",
			color: "fg",
			border: "0",
			borderInlineEndWidth: "0",
			borderRadius: "0",
			outline: "none",
			boxShadow: "none",
			textStyle: "label/S/regular",
			_focusVisible: {
				outline: "none",
				boxShadow: "none"
			}
		},
		trigger: {
			h: "full",
			minH: "0",
			maxH: "full",
			minW: "2rem",
			alignSelf: "stretch",
			px: "xs",
			bg: "transparent",
			color: "fg",
			border: "0",
			borderInlineStartWidth: "0",
			borderRadius: "0",
			outline: "none",
			boxShadow: "none",
			_hover: { bg: "bg.hover" },
			_focusVisible: {
				outline: "none",
				boxShadow: "none"
			}
		},
		content: {
			p: "sm",
			bg: "bg",
			color: "fg",
			borderWidth: "0",
			borderRadius: "xs"
		},
		swatch: {
			borderRadius: "2xs",
			borderWidth: "0"
		},
		swatchTrigger: {
			borderRadius: "2xs",
			_focusVisible: {
				outline: "1px solid",
				outlineColor: I
			}
		}
	},
	variants: { size: {
		xs: {
			control: { h: "1.75rem" },
			channelInput: {
				px: "xs",
				textStyle: "label/XS"
			},
			trigger: {
				minW: "1.75rem",
				px: "2xs"
			}
		},
		sm: {}
	} },
	defaultVariants: { size: "sm" }
}), R = _({
	slots: ae.keys(),
	base: {
		title: { textStyle: "heading/dialog" },
		content: {
			bg: "bg",
			borderRadius: "xs",
			borderWidth: "1px",
			borderColor: "border.subtle",
			overflow: "hidden"
		}
	},
	variants: { variant: { create: {
		content: {
			"--dialog-margin": "spacing.lg",
			maxH: "calc(100dvh - {spacing.lg} * 2)"
		},
		header: {
			display: "flex",
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			flexShrink: 0
		},
		body: { overflow: "visible" },
		footer: { flexShrink: 0 }
	} } }
}), z = g({ base: { borderColor: "border.subtle" } }), B = _({
	slots: oe.keys(),
	base: {
		header: {
			fontWeight: "medium",
			textStyle: "label/M/medium",
			p: "xs"
		},
		content: { bg: "bg" }
	}
}), V = _({
	slots: [
		"root",
		"preview",
		"input",
		"textarea"
	],
	base: {
		preview: {
			textStyle: "label/L/medium",
			borderRadius: "2xs",
			focusRingColor: "border",
			py: "0",
			lineHeight: "1.5rem",
			transitionProperty: "common",
			transitionDuration: "normal",
			_hover: { bg: "bg.hover" }
		},
		input: {
			textStyle: "label/L/medium",
			borderRadius: "2xs",
			focusRingColor: "border",
			py: "0",
			lineHeight: "1.5rem",
			transitionProperty: "common",
			transitionDuration: "normal",
			bg: "bg",
			width: "auto",
			_focusVisible: {
				outline: "2px solid",
				outlineColor: "border",
				outlineOffset: "2px"
			},
			_placeholder: { color: "fg.muted" }
		},
		textarea: {
			textStyle: "label/L/medium",
			borderRadius: "2xs",
			focusRingColor: "border",
			py: "0",
			transitionProperty: "common",
			transitionDuration: "normal",
			bg: "bg.muted",
			width: "auto",
			_focusVisible: {
				outline: "2px solid",
				outlineColor: "border",
				outlineOffset: "2px"
			},
			_placeholder: { color: "fg.muted" }
		}
	},
	variants: {
		variant: { "filter-segment": { input: {
			bg: "transparent",
			_focusVisible: { outline: "none" }
		} } },
		size: {
			xs: {
				root: {
					display: "inline-flex",
					alignItems: "center"
				},
				preview: {
					textStyle: "label/XS",
					lineHeight: "1rem",
					px: "xs",
					minH: "5",
					alignContent: "center"
				},
				input: {
					textStyle: "label/XS",
					lineHeight: "1rem",
					px: "xs",
					minH: "5"
				},
				textarea: {
					textStyle: "label/XS",
					lineHeight: "1rem",
					px: "xs"
				}
			},
			sm: {
				preview: {
					textStyle: "label/S/medium",
					lineHeight: "1.25rem"
				},
				input: {
					textStyle: "label/S/medium",
					lineHeight: "1.25rem"
				},
				textarea: {
					textStyle: "label/S/medium",
					lineHeight: "1.25rem"
				}
			},
			md: {
				preview: {
					textStyle: "label/M/medium",
					lineHeight: "1.375rem"
				},
				input: {
					textStyle: "label/M/medium",
					lineHeight: "1.375rem"
				},
				textarea: {
					textStyle: "label/M/medium",
					lineHeight: "1.375rem"
				}
			},
			lg: {
				preview: {
					textStyle: "label/L/medium",
					lineHeight: "1.5rem"
				},
				input: {
					textStyle: "label/L/medium",
					lineHeight: "1.5rem"
				},
				textarea: {
					textStyle: "label/L/medium",
					lineHeight: "1.5rem"
				}
			}
		}
	}
}), H = _({
	slots: [
		"content",
		"header",
		"body",
		"navigation",
		"navigationButton",
		"driveTrigger",
		"driveLabel",
		"path",
		"filter",
		"creation",
		"list",
		"rows",
		"footer"
	],
	base: {
		content: {
			width: "folder-picker-width",
			height: "folder-picker-height",
			maxWidth: "calc(100vw - {spacing.xl})",
			maxHeight: "calc(100dvh - {spacing.xl})"
		},
		header: {
			display: "flex",
			height: "folder-picker-header",
			flex: "0 0 auto",
			px: "md",
			py: "none",
			alignItems: "center"
		},
		body: {
			display: "flex",
			flexDirection: "column",
			gap: "sm",
			p: "md",
			minHeight: 0
		},
		navigation: {
			display: "flex",
			gap: "xs",
			flexShrink: 0,
			alignItems: "center"
		},
		navigationButton: {
			width: "8",
			minWidth: "8",
			px: "none"
		},
		driveTrigger: {
			flexShrink: 0,
			px: "xs",
			gap: "xs",
			"& svg": { boxSize: "icon-sm" }
		},
		driveLabel: {
			px: "md",
			pt: "xs",
			pb: "2xs",
			textStyle: "label/S/regular",
			color: "fg.muted"
		},
		path: {
			flex: 1,
			minWidth: 0,
			px: "2xs",
			textStyle: "label/S/medium"
		},
		filter: {
			width: "full",
			flexShrink: 0,
			"& svg": { boxSize: "icon-sm" }
		},
		creation: {
			display: "flex",
			gap: "sm",
			flexShrink: 0
		},
		list: {
			flex: 1,
			minHeight: 0
		},
		rows: {
			display: "flex",
			flexDirection: "column",
			gap: "2xs"
		},
		footer: {
			height: "14",
			flexShrink: 0,
			px: "md",
			py: "none",
			gap: "xs"
		}
	}
}), U = _({
	slots: se.keys(),
	base: { legend: { mb: "2xs" } }
}), W = "border.accent-light", G = g({
	base: {
		px: "sm",
		borderRadius: "xs",
		transition: "border-color 0.2s ease-in-out",
		bg: "bg",
		color: "fg",
		border: "1px solid",
		borderColor: "border",
		outline: "none",
		boxShadow: "none",
		"--focus-color": "var(--chakra-colors-border-accent-light)",
		"--focus-ring-style": "none",
		_hover: { borderColor: W },
		_active: { borderColor: W },
		_focus: {
			borderColor: W,
			outline: "none",
			boxShadow: "none"
		},
		_focusVisible: {
			borderColor: W,
			outline: "none",
			boxShadow: "none"
		},
		_placeholder: { color: "fg.subtle" },
		"&:is(:hover, [data-hover])": { borderColor: W },
		"&:is(:active, [data-active])": { borderColor: W }
	},
	variants: {
		variant: {
			outline: {
				bg: "bg",
				border: "1px solid",
				borderColor: "border",
				outline: "none",
				boxShadow: "none",
				"--focus-color": "var(--chakra-colors-border-accent-light)",
				"--focus-ring-style": "none",
				_hover: { borderColor: W },
				_active: { borderColor: W },
				_focus: {
					borderColor: W,
					outline: "none",
					boxShadow: "none"
				},
				_focusVisible: {
					borderColor: W,
					outline: "none",
					boxShadow: "none"
				},
				"&:is(:hover, [data-hover])": { borderColor: W },
				"&:is(:active, [data-active])": { borderColor: W }
			},
			borderless: {
				bg: "transparent",
				border: "0",
				borderColor: "transparent",
				borderRadius: "0",
				boxShadow: "none",
				transition: "none",
				_hover: {
					bg: "transparent",
					borderColor: "transparent"
				},
				_active: {
					bg: "transparent",
					borderColor: "transparent"
				},
				_focus: {
					borderColor: "transparent",
					outline: "none",
					boxShadow: "none"
				},
				_focusVisible: {
					borderColor: "transparent",
					outline: "none",
					boxShadow: "none"
				},
				"&:is(:hover, [data-hover])": { borderColor: "transparent" },
				"&:is(:active, [data-active])": { borderColor: "transparent" }
			}
		},
		size: {
			"2xs": {
				h: "1.5rem",
				px: "2xs",
				textStyle: "label/XS"
			},
			xs: {
				h: "1.75rem",
				px: "xs",
				textStyle: "label/XS"
			},
			sm: {
				h: "2rem",
				px: "sm",
				textStyle: "label/S/regular"
			},
			md: {
				h: "2.5rem",
				px: "sm",
				textStyle: "label/M/regular"
			},
			lg: {
				h: "3rem",
				px: "md",
				textStyle: "label/M/regular"
			}
		}
	},
	defaultVariants: {
		size: "sm",
		variant: "outline"
	}
}), le = _({
	slots: [
		"root",
		"header",
		"entry",
		"empty",
		"scrollbar"
	],
	base: {
		root: { paddingY: "compact" },
		header: { paddingX: "compact" },
		entry: {
			paddingX: "compact",
			paddingBottom: "xs"
		},
		empty: { paddingX: "compact" },
		scrollbar: { margin: "0" }
	}
}), ue = g({
	base: {
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
		flexShrink: "0",
		minW: "1.25rem",
		px: "1",
		borderRadius: "0",
		borderWidth: "1px",
		borderStyle: "solid",
		fontFamily: "mono",
		fontWeight: "medium",
		lineHeight: "1",
		userSelect: "none",
		whiteSpace: "nowrap",
		wordSpacing: "normal"
	},
	variants: {
		variant: {
			raised: {
				color: "fg.muted",
				bg: "bg.subtle",
				borderColor: "border",
				borderBottomWidth: "2px"
			},
			outline: {
				color: "fg.muted",
				bg: "transparent",
				borderColor: "border"
			},
			subtle: {
				color: "fg",
				bg: "bg.muted",
				borderColor: "border.subtle"
			},
			plain: {
				color: "fg.muted",
				bg: "transparent",
				borderColor: "transparent",
				minW: "auto",
				px: "0"
			}
		},
		size: {
			sm: {
				height: "1rem",
				textStyle: "label/XS/medium"
			},
			md: {
				height: "1.25rem",
				textStyle: "label/XS/medium"
			},
			lg: {
				height: "1.5rem",
				textStyle: "label/S/medium"
			}
		}
	},
	defaultVariants: {
		size: "md",
		variant: "raised"
	}
}), de = g({ variants: { variant: { resource: {
	textDecoration: "none",
	_hover: { textDecoration: "none" }
} } } }), fe = g({
	base: {
		display: "flex",
		alignItems: "center",
		flexShrink: 0
	},
	variants: { visibility: {
		always: {},
		hover: {
			visibility: "hidden",
			opacity: 0,
			_groupHover: {
				visibility: "visible",
				opacity: 1
			},
			_groupFocusWithin: {
				visibility: "visible",
				opacity: 1
			},
			"@media (hover: none)": {
				visibility: "visible",
				opacity: 1
			}
		}
	} },
	defaultVariants: { visibility: "always" }
}), pe = _({
	slots: ce.keys(),
	base: {
		itemGroupLabel: {
			ml: "{2xs}",
			textStyle: "label/S/regular",
			fontWeight: "normal",
			color: "fg.muted"
		},
		item: {
			width: "full",
			minWidth: "0",
			maxWidth: "full",
			minH: "1.75rem",
			h: "auto",
			display: "flex",
			alignItems: "center",
			justifyContent: "flex-start",
			gap: "xs",
			px: "sm",
			py: "2xs",
			borderRadius: "0",
			bg: "transparent",
			color: "fg.menu-item.default",
			textStyle: "label/S/regular",
			cursor: "pointer",
			overflow: "hidden",
			textAlign: "left",
			textDecoration: "none",
			_hover: { bg: "bg.menu-item.hover" },
			_highlighted: { bg: "bg.menu-item.hover" },
			_focusVisible: { bg: "bg.menu-item.focus" },
			"&[data-type]": { ps: "sm" },
			_disabled: {
				cursor: "not-allowed",
				color: "fg.muted"
			}
		},
		itemIndicator: {
			boxSize: "3.5",
			"& svg": { boxSize: "full" },
			position: "static",
			insetStart: "auto",
			top: "auto",
			transform: "none",
			color: "fg",
			marginInlineStart: "auto",
			order: 1,
			flexShrink: 0
		},
		itemText: {
			flex: "1",
			minWidth: "0",
			textAlign: "left"
		},
		itemCommand: { marginInlineStart: "auto" },
		separator: {
			my: "0",
			mx: "0",
			borderColor: "border.subtle"
		},
		content: {
			display: "flex",
			flexDirection: "column",
			width: "17.5rem",
			minWidth: "17.5rem",
			maxWidth: "17.5rem",
			gap: "0",
			borderRadius: "xs",
			p: "0",
			px: "0",
			py: "0",
			bg: "bg",
			borderWidth: "1px",
			borderStyle: "solid",
			borderColor: "border.subtle",
			textStyle: "label/M/regular"
		}
	},
	variants: {
		size: {
			sm: { item: { px: "sm" } },
			md: { item: { px: "sm" } }
		},
		variant: { panel: { content: {
			width: "64",
			minWidth: "64",
			maxWidth: "64",
			"&:has(iframe)": {
				h: "64",
				maxH: "var(--available-height)"
			}
		} } }
	}
}), me = g({ base: {
	display: "grid",
	gridTemplateRows: "0fr",
	visibility: "hidden",
	transition: "grid-template-rows {durations.tree-collapse} {easings.exit}, visibility 0s {durations.tree-collapse}",
	"&[data-open=true]": {
		gridTemplateRows: "1fr",
		visibility: "visible",
		transition: "grid-template-rows {durations.tree-expand} {easings.enter}, visibility 0s",
		_motionReduce: { transition: "none" }
	},
	"& > *": {
		minHeight: "0",
		overflow: "hidden"
	},
	_motionReduce: { transition: "none" }
} }), he = g({ base: {
	transform: "rotate(0deg)",
	transition: "transform {durations.tree-collapse} {easings.exit}",
	"&[data-open=true]": {
		transform: "rotate(90deg)",
		transition: "transform {durations.tree-expand} {easings.enter}",
		_motionReduce: { transition: "none" }
	},
	"&:is([data-tree-list-virtual] *)": { transition: "none" },
	_motionReduce: { transition: "none" }
} }), ge = g({ base: {
	visibility: "hidden",
	opacity: "0",
	transform: "translateY({spacing.2}) scale(0.96)",
	transformOrigin: "bottom right",
	transition: "opacity {durations.panel-close} {easings.exit}, transform {durations.panel-close} {easings.exit}, visibility 0s {durations.panel-close}",
	"&[data-open=true]": {
		visibility: "visible",
		opacity: "1",
		transform: "none",
		transition: "opacity {durations.panel-open} {easings.enter}, transform {durations.panel-open} {easings.enter}, visibility 0s",
		_startingStyle: {
			opacity: "0",
			transform: "translateY({spacing.2}) scale(0.96)"
		}
	},
	_motionReduce: {
		transform: "none",
		"&[data-open=true]": { _startingStyle: { transform: "none" } }
	}
} }), _e = g({ base: {
	"& > button": { transitionProperty: "background-color, border-color, box-shadow, color" },
	visibility: "visible",
	opacity: "1",
	transform: "none",
	transition: "opacity {durations.surface-enter} {easings.enter}, transform {durations.surface-enter} {easings.enter}, visibility 0s",
	"&[data-open=true]": {
		visibility: "hidden",
		opacity: "0",
		transform: "scale(0.9)",
		transition: "opacity {durations.surface-exit} {easings.exit}, transform {durations.surface-exit} {easings.exit}, visibility 0s {durations.surface-exit}"
	},
	_motionReduce: {
		transform: "none",
		"&[data-open=true]": { transform: "none" }
	}
} }), ve = g({ base: { "& .streaming-text-chunk": {
	animation: "text-chunk {durations.text-chunk} {easings.enter}",
	_motionReduce: { animation: "none" }
} } }), ye = "var(--chakra-colors-border)", K = "var(--chakra-colors-border-accent-light)", be = _({
	slots: v.keys(),
	base: {
		root: {
			position: "relative",
			zIndex: "0",
			isolation: "isolate",
			boxShadow: "none",
			"--number-input-border-color": ye,
			"&:is(:hover, [data-hover])": { "--number-input-border-color": K },
			"&:is(:active, [data-active])": { "--number-input-border-color": K },
			"&:focus-within": { "--number-input-border-color": K }
		},
		input: {
			px: "sm",
			pe: "calc(var(--stepper-width) + 0.5rem)",
			borderRadius: "xs",
			transition: "border-color 0.2s ease-in-out",
			bg: "bg",
			color: "fg",
			borderWidth: "1px",
			borderStyle: "solid",
			borderColor: "var(--number-input-border-color)",
			outline: "none",
			boxShadow: "none",
			"--focus-ring-color": "var(--number-input-border-color)",
			"--focus-ring-style": "none",
			_hover: { borderColor: "var(--number-input-border-color)" },
			_active: { borderColor: "var(--number-input-border-color)" },
			_focus: {
				borderColor: "var(--number-input-border-color)",
				outline: "none",
				boxShadow: "none"
			},
			_focusVisible: {
				borderColor: "var(--number-input-border-color)",
				outline: "none",
				boxShadow: "none"
			},
			_placeholder: { color: "fg.subtle" },
			"&:is(:hover, [data-hover])": { borderColor: "var(--number-input-border-color)" },
			"&:is(:active, [data-active])": { borderColor: "var(--number-input-border-color)" },
			"&:not([data-invalid], [aria-invalid='true'], [data-state='invalid'])": { borderColor: "var(--number-input-border-color)" }
		},
		control: {
			display: "flex",
			flexDirection: "column",
			position: "absolute",
			top: "0",
			insetEnd: "0",
			margin: "1px",
			width: "var(--stepper-width)",
			height: "calc(100% - 2px)",
			zIndex: "1",
			borderStartWidth: "1px",
			borderStartColor: "var(--number-input-border-color)",
			borderColor: "var(--number-input-border-color)",
			divideY: "1px",
			overflow: "hidden",
			boxShadow: "none",
			"& > :not(style, [hidden]) ~ :not(style, [hidden])": { borderColor: "var(--number-input-border-color)" }
		},
		incrementTrigger: {
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			flex: "1",
			minH: "0",
			lineHeight: "1",
			borderTopEndRadius: "xs",
			color: "fg.muted",
			_hover: {
				bg: "bg.hover",
				color: "fg"
			}
		},
		decrementTrigger: {
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			flex: "1",
			minH: "0",
			lineHeight: "1",
			borderBottomEndRadius: "xs",
			color: "fg.muted",
			_hover: {
				bg: "bg.hover",
				color: "fg"
			}
		}
	},
	variants: {
		variant: { outline: { input: {
			bg: "bg",
			borderWidth: "1px",
			borderStyle: "solid",
			borderColor: "var(--number-input-border-color)",
			outline: "none",
			boxShadow: "none",
			"--focus-ring-color": "var(--number-input-border-color)",
			"--focus-ring-style": "none",
			_hover: { borderColor: "var(--number-input-border-color)" },
			_active: { borderColor: "var(--number-input-border-color)" },
			_focus: {
				borderColor: "var(--number-input-border-color)",
				outline: "none",
				boxShadow: "none"
			},
			_focusVisible: {
				borderColor: "var(--number-input-border-color)",
				outline: "none",
				boxShadow: "none"
			},
			"&:is(:hover, [data-hover])": { borderColor: "var(--number-input-border-color)" },
			"&:is(:active, [data-active])": { borderColor: "var(--number-input-border-color)" },
			"&:not([data-invalid], [aria-invalid='true'], [data-state='invalid'])": { borderColor: "var(--number-input-border-color)" }
		} } },
		size: {
			"2xs": {
				input: {
					h: "1.5rem",
					px: "2xs",
					textStyle: "label/XS"
				},
				control: {
					"--stepper-width": "1.25rem",
					fontSize: "0.625rem"
				}
			},
			xs: {
				input: {
					h: "1.75rem",
					px: "xs",
					textStyle: "label/XS"
				},
				control: {
					"--stepper-width": "1.5rem",
					fontSize: "0.75rem"
				}
			},
			sm: {
				input: {
					h: "2rem",
					px: "sm",
					textStyle: "label/S/regular"
				},
				control: {
					"--stepper-width": "1.75rem",
					fontSize: "0.75rem"
				}
			},
			md: {
				input: {
					h: "2.5rem",
					px: "sm",
					textStyle: "label/M/regular"
				},
				control: {
					"--stepper-width": "2rem",
					fontSize: "0.875rem"
				}
			},
			lg: {
				input: {
					h: "3rem",
					px: "md",
					textStyle: "label/M/regular"
				},
				control: {
					"--stepper-width": "2.25rem",
					fontSize: "0.875rem"
				}
			}
		}
	},
	defaultVariants: {
		size: "sm",
		variant: "outline"
	}
}), xe = _({
	slots: [
		"positioner",
		"content",
		"results"
	],
	base: {
		positioner: {
			alignItems: "center",
			justifyContent: "center",
			p: "md"
		},
		content: {
			"--palette-results-height": "sizes.palette-results-height",
			maxW: "palette-width",
			w: "full",
			p: 0,
			m: 0,
			overflow: "hidden"
		}
	},
	variants: { fullScreen: { true: {
		positioner: { p: 0 },
		content: {
			"--palette-results-height": "none",
			maxW: "full",
			h: "100dvh",
			borderWidth: 0,
			borderRadius: "none",
			"& > .chakra-dialog__header, & > .chakra-dialog__footer": { flexShrink: 0 },
			"& > .chakra-dialog__body": {
				display: "flex",
				flexDirection: "column",
				minH: 0
			}
		},
		results: {
			flex: 1,
			minH: 0
		}
	} } }
}), Se = _({
	slots: y.keys(),
	base: {
		positioner: { _focus: { outline: "none" } },
		closeTrigger: {
			textStyle: "label/M/medium",
			color: "fg"
		},
		arrow: {
			bg: "background-primary !important",
			borderColor: "button-secondary-stroke"
		},
		content: {
			gap: "8px",
			px: "sm",
			py: "xs",
			borderRadius: "xs",
			bg: "bg",
			borderWidth: "1px",
			borderStyle: "solid",
			borderColor: "border.subtle",
			overflow: "visible",
			_focus: { outline: "none" }
		},
		title: {
			borderBottom: "none",
			textStyle: "label/M/medium",
			bg: "bg"
		},
		header: { padding: "0" },
		body: {
			padding: "0",
			textStyle: "primary"
		},
		footer: { padding: "0" }
	},
	variants: {
		variant: {
			panel: {
				content: {
					"--popover-size": "sizes.popover-panel",
					gap: "md",
					borderColor: "border"
				},
				title: { textStyle: "label/M/medium" }
			},
			responsive: { content: { width: "unset" } }
		},
		size: { "2xl": { content: { width: "2xl" } } }
	}
}), Ce = T.variants?.size ?? {}, we = {
	...T,
	variants: {
		...T.variants,
		size: {
			...Ce,
			"2xs": {
				circle: {
					"--size": "14px",
					"--thickness": "2px"
				},
				valueText: { textStyle: "2xs" }
			}
		}
	}
}, q = {
	root: {
		flexDirection: "column",
		height: "auto",
		overflow: "visible",
		gap: "panel-gap"
	},
	resizablePanel: {
		display: "flex",
		width: "full",
		height: "auto",
		flex: "initial",
		overflow: "visible"
	},
	panelContent: {
		width: "full",
		height: "auto",
		flex: "1"
	},
	contentPanel: {
		height: "auto",
		flex: "initial",
		overflow: "visible"
	},
	separator: { display: "none" }
}, Te = _({
	slots: [
		"root",
		"resizablePanel",
		"panelContent",
		"contentPanel",
		"separator"
	],
	base: {
		root: {
			display: "flex",
			width: "full",
			minWidth: 0,
			minHeight: 0
		},
		resizablePanel: {
			minWidth: 0,
			minHeight: 0,
			"&[data-collapsed=true]": { display: "none" }
		},
		panelContent: {
			display: "flex",
			flexDirection: "column",
			minWidth: 0,
			minHeight: 0,
			flexShrink: 0
		},
		contentPanel: {
			display: "flex",
			minWidth: 0,
			minHeight: 0
		},
		separator: { "&[data-collapsed=true]": { display: "none" } }
	},
	variants: {
		orientation: {
			horizontal: {
				root: {
					"--split-direction": "row",
					"--split-width": "var(--split-size)",
					"--split-height": "100%",
					"--split-content-width": "var(--split-stored-size)",
					"--split-content-height": "100%",
					"&[data-dragging=true]": { "--split-content-width": "var(--split-size)" }
				},
				separator: {
					width: "var(--split-separator-thickness)",
					height: "full",
					"&[data-collapsed=true]": { width: "0" }
				}
			},
			vertical: {
				root: {
					"--split-direction": "column",
					"--split-width": "100%",
					"--split-height": "var(--split-size)",
					"--split-content-width": "100%",
					"--split-content-height": "var(--split-stored-size)",
					"&[data-dragging=true]": { "--split-content-height": "var(--split-size)" }
				},
				separator: {
					width: "full",
					height: "var(--split-separator-thickness)",
					"&[data-collapsed=true]": { height: "0" }
				}
			}
		},
		separator: {
			gap: { separator: { "--split-separator-thickness": "{spacing.panel-gap}" } },
			line: { separator: { "--split-separator-thickness": "1px" } }
		},
		layout: {
			split: {
				root: {
					flexDirection: "var(--split-direction)",
					height: "full",
					overflow: "clip",
					gap: "0",
					transition: "--split-size {durations.panel-open} {easings.enter}",
					"&[data-collapsed=true]": {
						transition: "--split-size {durations.panel-close} {easings.exit}",
						_motionReduce: { transition: "none" }
					},
					"&[data-dragging=true]": { transition: "none" },
					_motionReduce: { transition: "none" }
				},
				resizablePanel: {
					display: "flex",
					width: "var(--split-width)",
					height: "var(--split-height)",
					flex: "0 0 var(--split-size)",
					overflow: "hidden",
					visibility: "visible",
					transition: "visibility 0s",
					"&[data-collapsed=true]": {
						display: "flex",
						visibility: "hidden",
						transition: "visibility 0s {durations.panel-close}",
						_motionReduce: { transition: "none" }
					},
					"[data-dragging=true] &": { transition: "none" },
					_motionReduce: { transition: "none" }
				},
				panelContent: {
					width: "var(--split-content-width)",
					height: "var(--split-content-height)"
				},
				contentPanel: {
					height: "full",
					flex: "1",
					overflow: "hidden"
				},
				separator: {
					display: "flex",
					visibility: "visible",
					transition: "visibility 0s, width 0s, height 0s",
					"&[data-collapsed=true]": {
						display: "flex",
						visibility: "hidden",
						transition: "visibility 0s {durations.panel-close}, width 0s {durations.panel-close}, height 0s {durations.panel-close}",
						_motionReduce: { transition: "none" }
					},
					"[data-dragging=true] &": { transition: "none" },
					_motionReduce: { transition: "none" }
				}
			},
			stacked: q,
			"stacked-reverse": {
				...q,
				root: {
					...q.root,
					flexDirection: "column-reverse"
				}
			},
			content: {
				root: {
					height: "full",
					overflow: "hidden"
				},
				resizablePanel: { display: "none" },
				contentPanel: {
					height: "full",
					flex: "1",
					overflow: "hidden"
				},
				separator: { display: "none" }
			}
		}
	},
	defaultVariants: {
		orientation: "horizontal",
		layout: "split",
		separator: "gap"
	}
}), Ee = _({
	slots: [
		"root",
		"viewport",
		"content",
		"scrollbar",
		"thumb",
		"corner"
	],
	base: {
		viewport: { outline: "none" },
		scrollbar: {
			borderRadius: "2xs",
			bg: "transparent",
			"--thumb-bg": "colors.border",
			"&:is(:hover, :active)": { "--thumb-bg": "colors.fg.subtle" },
			_vertical: { "&::before": { insetInlineStart: "calc(var(--scrollbar-size) - var(--scrollbar-click-area))" } },
			_horizontal: { "&::before": { top: "calc(var(--scrollbar-size) - var(--scrollbar-click-area))" } }
		},
		content: {
			"--thumb-width": "initial",
			"--thumb-height": "initial",
			"--corner-width": "initial",
			"--corner-height": "initial",
			"--scroll-area-overflow-x-start": "initial",
			"--scroll-area-overflow-x-end": "initial",
			"--scroll-area-overflow-y-start": "initial",
			"--scroll-area-overflow-y-end": "initial"
		}
	},
	variants: { size: { xs: { root: {
		"--scrollbar-size": "sizes.scrollbar-thin",
		"--scrollbar-click-area": "spacing.xs"
	} } } }
}), De = g({ base: {
	"--start-color": "fg",
	"--end-color": "fg.muted"
} }), J = "calc({sizes.chat-user-preview} - {sizes.chat-user-footer})", Oe = _({
	slots: [
		"root",
		"viewport",
		"body",
		"preview",
		"footer",
		"actions"
	],
	base: {
		actions: {
			px: "xs",
			pb: "xs"
		},
		root: {
			position: "relative",
			padding: "0",
			gap: "0",
			overflow: "hidden"
		},
		viewport: {
			maxHeight: J,
			overflowY: "hidden",
			minHeight: "0"
		},
		body: {
			display: "flex",
			flexDirection: "column",
			gap: "sm",
			padding: "xs",
			paddingBottom: "0"
		},
		preview: {
			position: "absolute",
			height: J,
			width: "0",
			visibility: "hidden",
			pointerEvents: "none"
		},
		footer: {
			position: "relative",
			flexShrink: "0",
			minHeight: "chat-user-footer",
			display: "flex",
			justifyContent: "space-between",
			alignItems: "center",
			padding: "xs",
			paddingTop: "0",
			background: "var(--chat-message-bg)",
			_before: {
				content: "\"\"",
				position: "absolute",
				bottom: "100%",
				left: "0",
				right: "0",
				height: "{spacing.3xl}",
				backgroundImage: "linear-gradient(to bottom, transparent, var(--chat-message-bg) 75%, var(--chat-message-bg))",
				pointerEvents: "none"
			}
		}
	},
	variants: { expanded: { true: {
		viewport: {
			maxHeight: "calc({sizes.chat-user-expanded} - {sizes.chat-user-footer})",
			overflowY: "auto"
		},
		footer: { _before: { display: "none" } }
	} } }
}), ke = _({
	slots: b.keys(),
	base: {
		control: {
			alignItems: "center",
			bg: "bg.muted",
			borderWidth: "1px",
			borderColor: "border",
			borderRadius: "md",
			color: "fg",
			boxShadow: "none",
			transition: "border-color 0.2s ease-in-out, background-color 0.2s ease-in-out",
			_hover: { borderColor: "border.accent-light" },
			_active: { borderColor: "border.accent-light" },
			_focusVisible: {
				borderColor: "border.accent-light",
				outline: "none",
				boxShadow: "none"
			},
			_checked: {
				bg: "bg.inverted",
				borderColor: "bg.inverted",
				_hover: { borderColor: "bg.inverted" },
				_active: { borderColor: "bg.inverted" }
			}
		},
		thumb: {
			bg: "bg",
			borderColor: "border",
			borderRadius: "full",
			_checked: { bg: "fg.inverted" }
		}
	},
	variants: { variant: { solid: {
		control: {
			borderRadius: "md",
			_checked: {
				bg: "bg.inverted",
				borderColor: "bg.inverted"
			}
		},
		thumb: { _checked: { bg: "fg.inverted" } }
	} } }
}), Ae = _({
	slots: x.keys(),
	base: {
		root: { "--tabs-trigger-radius": "radii.xs" },
		list: {
			maxW: "full",
			gap: "2xs",
			alignItems: "center",
			justifyContent: "flex-start",
			borderBottom: "0",
			_horizontal: { _before: { borderBottomWidth: "0" } }
		},
		trigger: {
			"&[data-reorderable]": {
				cursor: "grab",
				touchAction: "none"
			},
			"&[data-dragging]": { opacity: .5 },
			flexShrink: "0",
			overflow: "hidden",
			"&:has([data-tab-close])": {
				flex: "1 1 0",
				minW: "tab-min",
				maxW: "fit-content"
			},
			whiteSpace: "nowrap",
			"& [data-tab-label]": {
				minW: "0",
				maxW: "tab-label-max",
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap"
			},
			py: "0",
			borderRadius: "xs",
			borderWidth: "0",
			color: "fg.muted",
			bg: "transparent",
			_selected: {
				color: "fg",
				bg: "bg.muted"
			},
			_hover: {
				bg: "bg.hover",
				color: "fg"
			},
			_disabled: {
				color: "fg.subtle",
				bg: "transparent",
				_hover: {
					color: "fg.subtle",
					bg: "transparent"
				}
			}
		}
	},
	variants: {
		size: {
			xs: { trigger: {
				h: "1.25rem",
				px: "xs",
				gap: "2xs",
				textStyle: "label/XS/medium",
				_icon: {
					width: "0.75rem",
					height: "0.75rem"
				}
			} },
			sm: { trigger: {
				h: "1.5rem",
				px: "xs",
				gap: "2xs",
				textStyle: "label/XS/medium",
				_icon: {
					width: "0.875rem",
					height: "0.875rem"
				}
			} },
			md: { trigger: {
				h: "1.75rem",
				px: "0.5rem",
				gap: "xs",
				textStyle: "label/S/medium",
				_icon: {
					width: "0.875rem",
					height: "0.875rem"
				}
			} }
		},
		tray: { true: { list: {
			width: "100%",
			paddingX: "lg",
			paddingBottom: "xs",
			borderBottom: "1px solid",
			borderBottomColor: "border.subtle"
		} } },
		variant: { subtle: { trigger: {
			borderRadius: "var(--tabs-trigger-radius)",
			color: "fg.muted",
			bg: "transparent",
			_selected: {
				color: "fg",
				bg: "bg.muted"
			},
			_hover: {
				bg: "bg.hover",
				color: "fg"
			},
			_disabled: {
				bg: "transparent",
				color: "fg.subtle",
				_hover: {
					bg: "transparent",
					color: "fg.subtle"
				}
			}
		} } }
	},
	defaultVariants: {
		size: "xs",
		variant: "subtle"
	}
}), je = _({
	slots: S.keys(),
	base: {
		root: {
			display: "inline-flex",
			alignItems: "center",
			borderRadius: "pill",
			gap: "2xs",
			minW: "0",
			maxW: "64",
			flexShrink: "1"
		},
		label: {
			minW: "0",
			overflow: "hidden",
			whiteSpace: "nowrap",
			textOverflow: "ellipsis",
			cursor: "pointer",
			_focusVisible: {
				outline: "2px solid",
				outlineColor: "border",
				outlineOffset: "2px"
			}
		},
		startElement: {
			"& [data-status-dot]": {
				display: "block",
				boxSize: "status-dot",
				borderRadius: "full",
				bg: "fg.muted"
			},
			"& [data-tone=success]": { bg: "fg.success" },
			"& [data-tone=info]": { bg: "fg.info" },
			"& [data-tone=warning]": { bg: "fg.warning" },
			"& [data-tone=error]": { bg: "fg.error" }
		},
		closeTrigger: {
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			boxSize: "4",
			flexShrink: "0",
			borderRadius: "full",
			cursor: "pointer",
			_hover: { bg: "bg.hover" },
			_disabled: {
				cursor: "not-allowed",
				opacity: "0.5"
			},
			_focusVisible: {
				outline: "2px solid",
				outlineColor: "border"
			},
			"& svg": { boxSize: "3" }
		}
	},
	variants: {
		variant: { ticket: { root: j } },
		size: { composer: { root: {
			height: "7",
			minH: "7",
			px: "xs",
			py: "0",
			textStyle: "label/S/medium"
		} } }
	},
	defaultVariants: {
		variant: "ticket",
		size: "composer"
	}
}), Y = "border.accent-light", Me = g({
	base: {
		paddingX: "sm",
		paddingY: "xs",
		opacity: "1",
		outline: "none",
		boxShadow: "none",
		color: "fg",
		border: "1px solid",
		borderRadius: "xs",
		transition: "border-color 0.2s ease-in-out",
		borderColor: "border",
		"--focus-color": "var(--chakra-colors-border-accent-light)",
		"--focus-ring-style": "none",
		_hover: { borderColor: Y },
		_active: { borderColor: Y },
		_focus: {
			borderColor: Y,
			outline: "none",
			boxShadow: "none"
		},
		_focusVisible: {
			borderColor: Y,
			outline: "none",
			boxShadow: "none"
		},
		_placeholder: { color: "fg.subtle" },
		"&:is(:hover, [data-hover])": { borderColor: Y },
		"&:is(:active, [data-active])": { borderColor: Y }
	},
	variants: {
		variant: { outline: {
			bg: "bg",
			border: "1px solid",
			borderColor: "border",
			outline: "none",
			boxShadow: "none",
			"--focus-color": "var(--chakra-colors-border-accent-light)",
			"--focus-ring-style": "none",
			_hover: { borderColor: Y },
			_active: { borderColor: Y },
			_focus: {
				borderColor: Y,
				outline: "none",
				boxShadow: "none"
			},
			_focusVisible: {
				borderColor: Y,
				outline: "none",
				boxShadow: "none"
			},
			"&:is(:hover, [data-hover])": { borderColor: Y },
			"&:is(:active, [data-active])": { borderColor: Y }
		} },
		size: {
			"2xs": {
				paddingX: "2xs",
				paddingY: "2xs",
				textStyle: "label/XS"
			},
			xs: {
				paddingX: "xs",
				paddingY: "2xs",
				textStyle: "label/XS"
			},
			sm: {
				paddingX: "sm",
				paddingY: "xs",
				textStyle: "label/S/regular"
			},
			md: {
				paddingX: "sm",
				paddingY: "xs",
				textStyle: "label/M/regular"
			},
			lg: {
				paddingX: "md",
				paddingY: "sm",
				textStyle: "label/M/regular"
			}
		}
	},
	defaultVariants: {
		size: "sm",
		variant: "outline"
	}
}), Ne = _({
	slots: C.keys(),
	base: {
		root: {
			display: "flex",
			flexDirection: "column",
			width: "full",
			"--timeline-thickness": "1px",
			"--timeline-gutter": "4px"
		},
		item: {
			"--timeline-content-gap": "spacing.6",
			display: "flex",
			position: "relative",
			alignItems: "flex-start",
			flexShrink: 0,
			gap: "4",
			_last: { "--timeline-content-gap": "0" }
		},
		separator: {
			display: "var(--timeline-separator-display)",
			position: "absolute",
			borderStartWidth: "var(--timeline-thickness)",
			ms: "calc(-1 * var(--timeline-thickness) / 2)",
			insetInlineStart: "calc(var(--timeline-indicator-size) / 2)",
			insetBlock: "0",
			borderColor: "border.subtle"
		},
		indicator: {
			outline: "2px solid {colors.bg}",
			position: "relative",
			flexShrink: "0",
			boxSize: "var(--timeline-indicator-size)",
			fontSize: "var(--timeline-font-size)",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			borderRadius: "full",
			fontWeight: "medium",
			bg: "bg",
			color: "fg"
		},
		connector: {
			alignSelf: "stretch",
			position: "relative"
		},
		content: {
			display: "flex",
			flexDirection: "column",
			width: "full",
			gap: "0",
			paddingBottom: "0"
		},
		title: {
			display: "flex",
			fontWeight: "medium",
			flexWrap: "wrap",
			gap: "1.5",
			alignItems: "center",
			mt: "var(--timeline-margin)"
		},
		description: {
			color: "fg.muted",
			textStyle: "xs"
		}
	},
	variants: {
		variant: {
			tool: {
				content: { minWidth: "0" },
				title: {
					flexWrap: "nowrap",
					whiteSpace: "nowrap"
				}
			},
			solid: {},
			subtle: {},
			outline: { indicator: {
				borderWidth: "1px",
				borderColor: "border.subtle"
			} },
			plain: { indicator: {
				bg: "transparent",
				color: "fg"
			} }
		},
		showLastSeparator: {
			true: { item: { _last: { "--timeline-separator-display": "initial" } } },
			false: { item: { _last: { "--timeline-separator-display": "none" } } }
		},
		size: {
			sm: {
				root: {
					"--timeline-indicator-size": "sizes.4",
					"--timeline-font-size": "fontSizes.2xs"
				},
				title: { textStyle: "xs" }
			},
			md: {
				root: {
					"--timeline-indicator-size": "sizes.5",
					"--timeline-font-size": "fontSizes.xs"
				},
				title: { textStyle: "sm" }
			},
			lg: {
				root: {
					"--timeline-indicator-size": "sizes.6",
					"--timeline-font-size": "fontSizes.xs"
				},
				title: {
					mt: "0.5",
					textStyle: "sm"
				}
			},
			xl: {
				root: {
					"--timeline-indicator-size": "sizes.8",
					"--timeline-font-size": "fontSizes.sm"
				},
				title: {
					mt: "1.5",
					textStyle: "sm"
				}
			}
		}
	},
	defaultVariants: {
		size: "md",
		variant: "solid",
		showLastSeparator: !1
	}
}), Pe = _({
	slots: w.keys(),
	base: { content: {
		bg: "bg.inverted",
		borderRadius: "xs",
		color: "fg.inverted",
		"& .chakra-kbd": {
			color: "fg.inverted",
			bg: "transparent",
			borderColor: "border.inverted"
		}
	} }
}), Fe = /* @__PURE__ */ new Set([
	"boxShadow",
	"boxShadowColor",
	"textShadow"
]), X = /shadow/i, Ie = (e) => {
	if (!X.test(e)) return e;
	let t = e.split(",").map((e) => e.trim()).filter((e) => !X.test(e));
	if (t.length !== 0) return t.join(", ");
}, Z = (e) => Array.isArray(e) ? e.map(Z).filter((e) => e !== void 0) : typeof e == "string" ? Ie(e) : !e || typeof e != "object" ? e : Object.fromEntries(Object.entries(e).flatMap(([e, t]) => {
	if (Fe.has(e) || X.test(e)) return [];
	let n = Z(t);
	return n === void 0 ? [] : [[e, n]];
})), Q = (e) => {
	let { shadows: t, ...n } = e ?? {};
	return n;
}, Le = {
	badge: ["surface"],
	button: ["secondary", "surface"]
}, $ = (e) => {
	let t = { ...e ?? {} };
	for (let [e, n] of Object.entries(Le)) {
		let r = t[e];
		if (!r || typeof r != "object") continue;
		let i = r, a = i.variants, o = a?.variant;
		if (!o) continue;
		let s = new Set(n), c = Object.fromEntries(Object.entries(o).filter(([e]) => !s.has(e)));
		t[e] = {
			...i,
			variants: {
				...a,
				variant: c
			}
		};
	}
	return t;
}, Re = {
	...p,
	theme: {
		...p.theme,
		tokens: Q(p.theme?.tokens),
		semanticTokens: Q(p.theme?.semanticTokens),
		recipes: $(Z(p.theme?.recipes)),
		slotRecipes: Z(p.theme?.slotRecipes),
		layerStyles: Z(p.theme?.layerStyles),
		animationStyles: Z(p.theme?.animationStyles)
	}
}, ze = h({
	chatContent: { value: {
		width: "full",
		minWidth: "0",
		maxWidth: "chat-content",
		marginInline: "auto"
	} },
	settingsHeader: { value: {
		padding: "lg",
		bg: "bg",
		borderBottomWidth: "1px",
		borderColor: "border.subtle"
	} },
	optionCard: { value: {
		padding: "sm",
		borderWidth: "1px",
		borderColor: "border.subtle",
		borderRadius: "compact",
		"&:has(input:checked)": { borderColor: "border.accent" }
	} },
	markdownEditorInset: { value: { padding: "lg" } },
	statusBarItem: { value: {
		position: "relative",
		minWidth: "0",
		height: "full",
		"&[data-sortable]": { cursor: "grab" },
		"&[data-dragging]": { opacity: .5 }
	} },
	dropIndicator: { value: {
		position: "absolute",
		zIndex: "1",
		borderRadius: "2xs",
		bg: "bg.accent-primary.default",
		pointerEvents: "none"
	} },
	tabDropZone: { value: { _after: {
		content: "\"\"",
		position: "absolute",
		inset: "3xs",
		borderWidth: "1px",
		borderColor: "bg.accent-primary.default",
		borderRadius: "compact",
		pointerEvents: "none"
	} } },
	panelDropZone: { value: {
		_after: {
			content: "\"\"",
			position: "absolute",
			inset: "3xs",
			borderWidth: "1px",
			borderColor: "bg.accent-primary.default",
			borderRadius: "compact",
			pointerEvents: "none"
		},
		"&[data-drop-active]::after": { bg: "bg.accent-primary.default/20" }
	} },
	panelDragSurface: { value: {
		"&[data-panel-draggable]": { cursor: "grab" },
		"&[data-panel-draggable]:has(:is(button, a, input, textarea, select, iframe, [role=tab], [role=treeitem], [role=button], [role=menuitem], [contenteditable=true]):hover)": { cursor: "auto" },
		"&[data-panel-dragging]": { cursor: "grabbing" }
	} },
	panelDragging: { value: { cursor: "grabbing" } },
	mirroredIcon: { value: { transform: "scaleX(-1)" } },
	filterPicker: { value: { height: "min({sizes.filter-picker-height}, calc(100dvh - {spacing.xl}))" } },
	filterLabel: { value: {
		paddingInline: "xs",
		borderRightWidth: "1px",
		borderColor: "border.subtle",
		height: "full",
		display: "inline-flex"
	} },
	filterPill: { value: {
		height: "filter-pill",
		borderWidth: "1px",
		borderColor: "border.subtle",
		borderRadius: "xs",
		bg: "bg.muted"
	} },
	floatingBar: { value: {
		paddingInline: "sm",
		paddingBlock: "2xs",
		borderRadius: "md",
		bg: "bg.elevated",
		border: "1px solid",
		borderColor: "border",
		boxShadow: "lg"
	} },
	panel: { value: {
		borderRadius: "sm",
		borderWidth: "1px",
		borderColor: "border.subtle",
		overflow: "hidden"
	} },
	dropZone: {
		idle: { value: {
			borderRadius: "sm",
			borderWidth: "1px",
			borderStyle: "dashed",
			borderColor: "border"
		} },
		active: { value: {
			borderRadius: "sm",
			borderWidth: "1px",
			borderStyle: "dashed",
			borderColor: "border.accent",
			bg: "bg.subtle"
		} }
	},
	modal: { value: {
		paddingInline: "xs",
		paddingBlock: "sm",
		borderRadius: "xs",
		bg: "bg",
		border: "1px solid",
		borderColor: "border"
	} }
}), Be = ne({
	"heading/dialog": { value: {
		fontFamily: "heading",
		fontSize: "0.9375rem",
		fontWeight: "600",
		lineHeight: "140%"
	} },
	brand: { value: {
		fontFamily: "brand",
		fontSize: "3xl",
		fontWeight: "500"
	} },
	"heading/display/L": { value: {
		fontFamily: "display",
		fontWeight: "600",
		fontSize: [
			"5xl",
			"5xl",
			"5xl",
			"6xl"
		],
		lineHeight: "120%"
	} },
	"heading/display/M": { value: {
		fontFamily: "display",
		fontWeight: "600",
		fontSize: ["4xl", "5xl"],
		lineHeight: "120%"
	} },
	"heading/display/S": { value: {
		fontFamily: "display",
		fontWeight: "600",
		fontSize: ["3xl", "4xl"],
		lineHeight: "120%"
	} },
	"heading/XL": { value: {
		fontFamily: "heading",
		fontSize: "5xl",
		fontWeight: "500",
		lineHeight: "120%"
	} },
	"heading/L": { value: {
		fontFamily: "heading",
		fontSize: "4xl",
		fontWeight: "500",
		lineHeight: "110%"
	} },
	"heading/M": { value: {
		fontFamily: "heading",
		fontSize: "3xl",
		fontWeight: "500",
		lineHeight: "120%"
	} },
	"heading/S": { value: {
		fontFamily: "heading",
		fontSize: "2xl",
		fontWeight: "500",
		lineHeight: "120%"
	} },
	"label/XL/regular": { value: {
		fontFamily: "label",
		fontSize: "2xl",
		fontWeight: "400",
		lineHeight: "150%",
		letterSpacing: "0.16px"
	} },
	"label/L/regular": { value: {
		fontFamily: "label",
		fontSize: "lg",
		fontWeight: "400",
		lineHeight: "20px",
		letterSpacing: "0.16px"
	} },
	"label/L/medium": { value: {
		fontFamily: "label",
		fontSize: "lg",
		fontWeight: "500",
		lineHeight: "20px",
		letterSpacing: "0.16px"
	} },
	"label/L/medium/underline": { value: {
		textDecoration: "underline",
		fontFamily: "label",
		fontSize: "lg",
		fontWeight: "500",
		lineHeight: "20px",
		letterSpacing: "0.16px"
	} },
	"label/L/medium/uppercase": { value: {
		letterSpacing: "0.089rem",
		fontFamily: "label",
		fontWeight: "600",
		fontSize: "lg",
		lineHeight: "150%",
		textTransform: "uppercase",
		color: "fg.muted"
	} },
	"label/M/regular": { value: {
		fontFamily: "label",
		fontSize: "md",
		fontWeight: "400",
		lineHeight: "150%",
		letterSpacing: "0.14px"
	} },
	"label/M/regular/underline": { value: {
		fontFamily: "label",
		fontSize: "md",
		fontWeight: "400",
		lineHeight: "150%",
		textDecoration: "underline",
		letterSpacing: "0.14px"
	} },
	"label/M/medium": { value: {
		fontFamily: "label",
		fontSize: "md",
		fontWeight: "500",
		lineHeight: "150%",
		letterSpacing: "0.14px"
	} },
	"label/S/regular": { value: {
		fontFamily: "label",
		fontSize: "sm",
		fontWeight: "400",
		lineHeight: "150%",
		letterSpacing: "0.12px"
	} },
	"label/S/medium": { value: {
		fontFamily: "label",
		fontSize: "sm",
		fontWeight: "500",
		lineHeight: "150%",
		letterSpacing: "0.12px"
	} },
	"label/S/italic": { value: {
		fontFamily: "label",
		fontSize: "sm",
		fontWeight: "400",
		lineHeight: "150%",
		letterSpacing: "0.12px",
		fontStyle: "italic"
	} },
	"label/XS": { value: {
		fontFamily: "label",
		fontSize: "xs",
		fontWeight: "400",
		lineHeight: "150%",
		letterSpacing: "0.1px"
	} },
	"label/XS/caps": { value: {
		fontFamily: "label",
		fontSize: "xs",
		fontWeight: "600",
		lineHeight: "150%",
		letterSpacing: "0.9px",
		textTransform: "uppercase"
	} },
	"label/XS/medium": { value: {
		fontFamily: "label",
		fontSize: "xs",
		fontWeight: "500",
		lineHeight: "150%",
		letterSpacing: "0.1px"
	} },
	"label/2XS": { value: {
		fontFamily: "label",
		fontSize: "2xs",
		fontWeight: "400",
		lineHeight: "150%",
		letterSpacing: "0.08px"
	} },
	"label/2XS/medium": { value: {
		fontFamily: "label",
		fontSize: "2xs",
		fontWeight: "500",
		lineHeight: "150%",
		letterSpacing: "0.08px"
	} },
	"mono/XS": { value: {
		fontFamily: "mono",
		fontSize: "xs",
		fontWeight: "400",
		lineHeight: "150%"
	} },
	"mono/3XL/semibold": { value: {
		fontFamily: "mono",
		fontSize: "3xl",
		fontWeight: "600",
		lineHeight: "100%"
	} },
	"mono/S": { value: {
		fontFamily: "mono",
		fontSize: "sm",
		fontWeight: "400",
		lineHeight: "160%"
	} },
	"paragraph/S/regular": { value: {
		fontFamily: "body",
		fontSize: "sm",
		fontWeight: "400",
		lineHeight: "135%",
		letterSpacing: "0.12px"
	} },
	"paragraph/M/regular": { value: {
		fontFamily: "body",
		fontSize: "md",
		fontWeight: "400",
		lineHeight: "171%",
		letterSpacing: "0.14px"
	} },
	"paragraph/M/medium": { value: {
		fontFamily: "body",
		fontSize: "md",
		fontWeight: "500",
		lineHeight: "171%",
		letterSpacing: "0.14px"
	} },
	"paragraph/L/regular": { value: {
		fontFamily: "body",
		fontSize: "lg",
		fontWeight: "400",
		lineHeight: "150%",
		letterSpacing: "0.14px"
	} },
	"paragraph/L/medium": { value: {
		fontFamily: "body",
		fontSize: "lg",
		fontWeight: "500",
		lineHeight: "150%",
		letterSpacing: "0.14px"
	} },
	"paragraph/XL/regular": { value: {
		fontFamily: "body",
		fontWeight: "400",
		lineHeight: "150%",
		fontSize: ["xl", "2xl"],
		color: "fg",
		letterSpacing: "0.14px"
	} },
	"paragraph/XL/medium": { value: {
		fontFamily: "body",
		fontWeight: "500",
		lineHeight: "150%",
		fontSize: ["xl", "2xl"],
		color: "fg",
		letterSpacing: "0.14px"
	} }
}), Ve = m({
	conditions: { startingStyle: "@starting-style" },
	globalCss: E,
	utilities: { WebkitAppRegion: {
		values: ["drag", "no-drag"],
		transform: (e) => ({ WebkitAppRegion: e })
	} },
	theme: {
		breakpoints: {
			"3xl": "2560px",
			"4xl": "3840px"
		},
		textStyles: Be,
		layerStyles: ze,
		recipes: {
			bubbleLauncher: _e,
			bubblePanel: ge,
			streamingText: ve,
			treeChevron: he,
			treeReveal: me,
			chatQuestionBubble: e,
			badge: M,
			button: P,
			divider: z,
			input: G,
			kbd: ue,
			link: de,
			listRowAccessory: fe,
			skeleton: De,
			textarea: Me
		},
		tokens: {
			durations: D,
			easings: O,
			colors: te,
			borderWidths: c,
			fonts: a,
			fontSizes: l,
			fontWeights: r,
			radii: i,
			sizes: n,
			spacing: s
		},
		semanticTokens: {
			colors: ee,
			borders: o
		},
		slotRecipes: {
			kanbanBoardColumn: le,
			stickyUserMessage: Oe,
			scrollArea: Ee,
			queuedFollowUp: t,
			tag: je,
			checkbox: F,
			windowTitleBar: u,
			windowTabs: d,
			resizableSplitLayout: Te,
			alert: A,
			colorPicker: L,
			drawer: B,
			tooltip: Pe,
			popover: Se,
			menu: pe,
			numberInput: be,
			palette: xe,
			editable: V,
			form: U,
			dialog: R,
			folderPicker: H,
			progressCircle: we,
			switch: ke,
			tabs: Ae,
			timeline: Ne
		}
	}
}), He = f(Re, Ve);
export { He as t };
