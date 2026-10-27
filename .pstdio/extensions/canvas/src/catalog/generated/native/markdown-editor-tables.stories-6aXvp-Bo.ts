// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./markdown-editor-w_pQ9qpB.ts";
import { useState as t } from "react";
import { Box as n, Grid as r, Text as i, Textarea as a } from "@chakra-ui/react";
import { jsx as o, jsxs as s } from "react/jsx-runtime";
// packages/ui/src/components/rich-text/markdown-editor/markdown-table.story-fixture.ts
var c = "| **Legacy source term** | **Public status** | **Maps to** | **Retrieval aliases** |\n| --- | --- | --- | --- |\n| `1980s power dressing` | retrieval-only | `STYLE.POWER_DRESSING`, `STYLE.ERA_1980S` | power shoulders outfit; strong shoulder suit; 80s corporate style; bold power outfit; authoritative dressing |\n| `70s outfits` | retrieval-only | `STYLE.ERA_1970S` | 70s fashion women; seventies outfit; retro 70s style; 1970s inspired look; disco era fashion |\n| `80s outfits women` | retrieval-only | `STYLE.ERA_1980S` | eighties fashion women; 80s inspired look; power dressing outfit; retro eighties style; decade dressing 80s |\n| `90s grunge` | retrieval-only | `STYLE.ERA_1990S_GRUNGE` | grunge outfit; grunge style; grunge aesthetic women; alternative grunge look; nineties grunge fashion |\n| `90s outfits` | retrieval-only | `STYLE.ERA_1990S` | nineties fashion; 90s inspired outfit; nineties aesthetic; 90s style women; retro 90s look |\n| `all black outfit` | retrieval-only | `STYLE.MONOCHROME_BLACK`, `STYLE.MONOCHROME` | head to toe black; total black look; black on black outfit; all black everything; monochrome black |\n| `athleisure` | retrieval-only | `STYLE.ATHLEISURE`, `STYLE.SPORTY` | sporty casual outfit; athletic casual wear; sport luxe; gym to street outfit; active lifestyle fashion |\n| `balletcore` | retrieval-only | `STYLE.BALLETCORE` | ballet core; balletcore aesthetic; ballet inspired fashion; dancer aesthetic; ballet flat outfit |\n| `black outfit` | retrieval-only | `STYLE.MONOCHROME_BLACK` | black clothing outfit; wearing black; black fashion women; black wardrobe look; dark outfit women |\n| `boho style` | retrieval-only | `STYLE.BOHEMIAN` | free spirited fashion; boho wardrobe; boho clothes; boho aesthetic; refined bohemian; free spirit style; bohemian clothes; bohemian chic; hippie inspired clothes; hippie chic; boho fashion women; elevated boho; modern bohemian style; bohemian style; boho clothing women; boho elegant; boho chic style |\n| `capsule wardrobe` | retrieval-only | `STYLE.CAPSULE_WARDROBE`, `STYLE.MINIMALIST` | minimal wardrobe; curated wardrobe; essential wardrobe; core wardrobe pieces; versatile wardrobe |\n| `chic casual wear` | retrieval-only | `STYLE.CHIC_CASUAL` | elevated casual; smart casual everyday; casual chic |\n| `city chic` | retrieval-only | `STYLE.CITY_CHIC` | smart urban dress; cosmopolitan fashion; urban chic dress; metropolitan style; city style dress; urban chic; urban elegant; polished city dress; city style women; metropolitan dress; city chic dresses |\n| `classic clothes for women` | restricted | `STYLE.CLASSIC` | timeless fashion women; classic wardrobe staples; enduring style women; traditional elegant clothing; forever fashion women |\n| `clean girl aesthetic` | blocked | `STYLE.MINIMALIST`, `STYLE.SPORTY` | neutral minimal outfit; effortless minimal aesthetic; clean girl style; cleangirl; cleangirl aesthetic; slicked back minimal look; clean girl |\n| `coastal cowgirl outfit` | retrieval-only | `STYLE.COASTAL_COWGIRL`, `STYLE.WESTERN` | beach western outfit; sandy cowgirl look; boho western outfit; surf meets country outfit; relaxed cowgirl style |\n| `coastal grandmother` | blocked | `STYLE.RELAXED`, `STYLE.RESORT`, `STYLE.NAUTICAL`, `STYLE.MINIMALIST` | coastal grandma style; hamptons aesthetic; relaxed coastal fashion; linen neutral outfit; seaside chic |\n| `color blocking fashion` | retrieval-only | `STYLE.COLOR_BLOCKING` | color block outfit; blocked color dressing; bold color panel outfit; contrasting color look |\n| `coquette` | retrieval-only | `STYLE.COQUETTE` | coquette aesthetic; coquette style; bow aesthetic; soft feminine coquette; romantic girly style |\n| `cottagecore` | retrieval-only | `STYLE.COTTAGECORE` | cottage core; prairie dress aesthetic; rural romantic style; pastoral fashion; countryside aesthetic |\n| `cowgirl outfit` | retrieval-only | `STYLE.WESTERN` | western outfit women; country girl outfit; cowboy boot outfit; rodeo outfit women; western wear women |\n| `dark academia` | inactive | `STYLE.DARK_ACADEMIA` | dark scholar aesthetic; gothic intellectual style; moody academic outfit; dark literary fashion; autumn scholar look |\n| `double denim` | inactive | `STYLE.DOUBLE_DENIM` | denim on denim; canadian tuxedo; all denim outfit; denim co-ord; matching denim set |\n| `elevated basics` | retrieval-only | `STYLE.ELEVATED_BASICS`, `STYLE.MINIMALIST`, `STYLE.TAILORED` | refined basics; elevated everyday wear |\n| `feminine clothing` | blocked | `STYLE.ROMANTIC` | feminine fashion; girly outfits women; soft feminine style; pretty clothes women; romantic fashion |\n| `island style` | retrieval-only | `STYLE.ISLAND`, `STYLE.RESORT` | vacation tropical look; island outfit women; resort tropical style; tropical outfit; tropical fashion; paradise outfit |\n| `italian summer outfits` | restricted | `STYLE.ITALIAN_SUMMER`, `STYLE.RESORT` | italian style summer; la dolce vita outfit; italian chic summer; mediterranean summer fashion; italian holiday clothes |\n| `maximalism` | retrieval-only | `STYLE.MAXIMALIST` | maximalist fashion; bold dressing; more is more outfit; statement dressing; eclectic style women |\n| `mob wife aesthetic` | blocked | `STYLE.MAXIMALIST`, `STYLE.GLAM` | mob wife; mob wife style; glamorous maximalist outfit; fur and leopard aesthetic; old hollywood glam |\n| `modest dresses for women` | blocked | — | covered up dress; conservative dress; modest fashion; modest style women; modest outfit ideas |\n| `monochrome` | retrieval-only | `STYLE.MONOCHROME` | tonal outfit; one color outfit; monochromatic look; single color dressing; head to toe color |\n| `nautical clothing` | retrieval-only | `STYLE.NAUTICAL` | nautical style; sailor style outfit; maritime fashion; navy stripe outfit; nautical chic |\n| `office siren outfit` | blocked | `STYLE.TAILORED`, `STYLE.POWER_DRESSING` | office siren; sexy office outfit; corporate siren |\n| `old money outfits` | blocked | `STYLE.QUIET_LUXURY`, `STYLE.PREPPY`, `STYLE.TAILORED` | quiet luxury outfit; stealth wealth style; understated elegance; classic wealth aesthetic; heritage style |\n| `Parisian style` | restricted | `STYLE.PARISIAN` | effortless parisian look; french style fashion; parisian aesthetic; french wardrobe staples; french inspired outfit; la vie en style; french chic; french girl style; parisian wardrobe; parisian style fashion; parisian fashion; effortless french look; french style clothing; paris inspired fashion; french woman style; french minimalist fashion; french chic fashion |\n| `power suit women` | retrieval-only | `STYLE.POWER_SUIT`, `STYLE.POWER_DRESSING` | womens power suit; authority outfit; commanding outfit women; boss outfit women; strong suit look |\n| `preppy style` | retrieval-only | `STYLE.PREPPY` | collegiate style; collegiate outfit; preppy aesthetic; classic American style; preppy style women; private school style; ivy league fashion; ivy league outfit; east coast style; preppy fashion women; preppy outfits |\n| `scandinavian style` | restricted | `STYLE.SCANDINAVIAN`, `STYLE.MINIMALIST` | scandi style; nordic fashion; minimalist nordic outfit; scandi chic; danish style women |\n| `street wear for ladies` | retrieval-only | — |\n| `summer capsule wardrobe` | retrieval-only | `STYLE.CAPSULE_WARDROBE`, `STYLE.RESORT` | summer essentials wardrobe; warm weather capsule; seasonal capsule; summer core wardrobe |\n| `tennis aesthetic` | retrieval-only | `STYLE.TENNIS`, `STYLE.PREPPY`, `STYLE.SPORTY` | tennis inspired outfit; court style fashion; tennis chic; wimbledon inspired outfit; tennis player style |\n| `western chic outfit` | retrieval-only | `STYLE.WESTERN`, `STYLE.TAILORED` | elevated western wear; polished cowgirl look; upscale western outfit; designer western style; refined western fashion |\n| `western dresses` | retrieval-only | `STYLE.WESTERN` | cowboy inspired dress; frontier dress; country style dress; western style dress; western boho style; western boho dress |\n| `Y2K outfits` | retrieval-only | `STYLE.Y2K` | Y2K fashion; early 2000s outfit; noughties fashion; 2000s inspired look; millennial fashion comeback |", l = "| Name | Name |  | Code |\n| :--- | ---: | :---: | --- |\n| Alice | Admin | a\\|b | `left\\|right` |\n| **Bob** |  | ~~old~~ | 0 |", u = "Visible content before the comments.\n\n<!-- fds:source-only:start -->\n\n<!-- This source-only marker stays in Markdown but is hidden here. -->\n\n<!-- fds:source-only:end -->\n\nVisible content after the comments.", d = (c) => {
	let { initialValue: l } = c, [u, d] = t(l);
	return /* @__PURE__ */ s(r, {
		gridTemplateRows: "minmax(0, 1fr) auto",
		height: "calc(100vh - var(--chakra-spacing-lg))",
		gap: "sm",
		children: [/* @__PURE__ */ o(n, {
			minHeight: "0",
			borderWidth: "1px",
			borderColor: "border.subtle",
			borderRadius: "md",
			overflow: "hidden",
			children: /* @__PURE__ */ o(e, {
				defaultState: l,
				isEditable: !0,
				onChange: d
			})
		}), /* @__PURE__ */ s(n, { children: [/* @__PURE__ */ o(i, {
			textStyle: "label/S/medium",
			marginBottom: "2xs",
			children: "Live emitted Markdown"
		}), /* @__PURE__ */ o(a, {
			value: u,
			readOnly: !0,
			autoresize: !0,
			maxHeight: "48",
			fontFamily: "mono",
			textStyle: "paragraph/S/regular"
		})] })]
	});
}, f = {
	title: "Patterns/Editors/Markdown Editor/Tables",
	component: e,
	parameters: { layout: "fullscreen" },
	decorators: [(e) => /* @__PURE__ */ o(n, {
		padding: "sm",
		background: "bg",
		children: /* @__PURE__ */ o(e, {})
	})]
}, p = { render: () => /* @__PURE__ */ o(d, { initialValue: c }) }, m = { render: () => /* @__PURE__ */ o(d, { initialValue: "" }) }, h = { render: () => /* @__PURE__ */ o(n, {
	height: "calc(100vh - var(--chakra-spacing-lg))",
	borderWidth: "1px",
	borderColor: "border.subtle",
	children: /* @__PURE__ */ o(e, {
		defaultState: "",
		isEditable: !0
	})
}) }, g = { render: () => /* @__PURE__ */ o(d, { initialValue: l }) }, _ = { render: () => /* @__PURE__ */ o(d, { initialValue: u }) }, v = {
	args: {
		defaultState: l,
		isEditable: !1
	},
	render: (t) => /* @__PURE__ */ o(n, {
		borderWidth: "1px",
		borderColor: "border.subtle",
		borderRadius: "md",
		children: /* @__PURE__ */ o(e, { ...t })
	})
};
export { g as DifficultTableSyntax, p as EditableLargeTable, _ as HiddenPreservedComments, v as ReadOnlyRenderedContent, m as SlashCommands, h as TallImageEditing, f as default };
