// Draw a bento benchmark chart as paired light and dark SVGs.
// Usage: bun bento-chart.ts <spec.json> <output-prefix>
// Writes <output-prefix>-light.svg and <output-prefix>-dark.svg.
import { readFileSync, writeFileSync } from "node:fs";

interface BarsTile {
  kind: "bars";
  title: string;
  before: { value: number; label: string };
  after: { value: number; label: string };
  wide?: boolean;
}

interface NumberTile {
  kind: "number";
  title: string;
  value: string;
  wide?: boolean;
}

type Tile = BarsTile | NumberTile;

// Values from the @pstdio/ui vis tokens and bg.muted. Dark uses blue.600 to stay inside the dark lightness band.
const THEMES = {
  light: {
    surface: "#FFFFFF",
    tile: "#F0F5F1",
    accent: "#0E6EF6",
    before: "#9DA0A6",
    text: "#22252C",
    muted: "#5A5F67",
  },
  dark: {
    surface: "#07090E",
    tile: "#171A22",
    accent: "#2B82FF",
    before: "#5A5F67",
    text: "#F5F5F5",
    muted: "#9DA0A6",
  },
};
type Theme = (typeof THEMES)["light"];

// Two columns at 880 px keep text readable when the article shrinks the image on a phone.
const WIDTH = 880;
const GAP = 14;
const ROW_HEIGHT = 212;
const PAD = 28;
const COLUMN_WIDTH = (WIDTH - GAP) / 2;
const FONT = `font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"`;

const escapeXml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;");

// Wide tiles take a full row; other tiles fill two columns in order.
const place = (tiles: Tile[]) => {
  const placed: { tile: Tile; row: number; column: number; span: number }[] = [];
  let row = 0;
  let column = 0;
  for (const tile of tiles) {
    if (tile.wide && column > 0) {
      row += 1;
      column = 0;
    }
    const span = tile.wide ? 2 : 1;
    placed.push({ tile, row, column, span });
    column += span;
    if (column >= 2) {
      row += 1;
      column = 0;
    }
  }
  return { placed, rows: column > 0 ? row + 1 : row };
};

// A bar with a rounded data end and a square end on the baseline.
const bar = (x: number, y: number, width: number, height: number, fill: string) => {
  const radius = Math.min(6, width / 2);
  return `<path d="M${x},${y} H${x + width - radius} Q${x + width},${y} ${x + width},${y + radius} V${y + height - radius} Q${x + width},${y + height} ${x + width - radius},${y + height} H${x} Z" fill="${fill}"/>`;
};

const barRows = (theme: Theme, tile: BarsTile, x: number, y: number, width: number) => {
  const labelWidth = 104;
  const valueWidth = 120;
  const barHeight = 40;
  const top = y + ROW_HEIGHT - PAD - (2 * barHeight + 16);
  const scale = (width - PAD * 2 - labelWidth - valueWidth) / Math.max(tile.before.value, tile.after.value);
  const rows = [
    { name: "Before", data: tile.before, fill: theme.before, strong: false },
    { name: "After", data: tile.after, fill: theme.accent, strong: true },
  ];
  return rows
    .map((row, index) => {
      const rowY = top + index * (barHeight + 16);
      const barWidth = Math.max(4, row.data.value * scale);
      const color = row.strong ? theme.text : theme.muted;
      const weight = row.strong ? 600 : 400;
      const text = (textX: number, value: string) =>
        `<text x="${textX}" y="${rowY + 28}" font-size="24" font-weight="${weight}" fill="${color}">${escape(value)}</text>`;
      return [
        text(x + PAD, row.name),
        bar(x + PAD + labelWidth, rowY, barWidth, barHeight, row.fill),
        text(x + PAD + labelWidth + barWidth + 12, row.data.label),
      ].join("");
    })
    .join("");
};

const describe = (tile: Tile) =>
  tile.kind === "number"
    ? `${tile.title}: ${tile.value}`
    : `${tile.title}: ${tile.before.label} before, ${tile.after.label} after`;

const render = (theme: Theme, tiles: Tile[]) => {
  const { placed, rows } = place(tiles);
  const height = rows * ROW_HEIGHT + (rows - 1) * GAP;
  const body = placed.map(({ tile, row, column, span }) => {
    const x = column * (COLUMN_WIDTH + GAP);
    const y = row * (ROW_HEIGHT + GAP);
    const width = span * COLUMN_WIDTH + (span - 1) * GAP;
    const title = `<text x="${x + PAD}" y="${y + PAD + 22}" font-size="28" font-weight="600" fill="${theme.text}">${escape(tile.title)}</text>`;
    const content =
      tile.kind === "number"
        ? `<text x="${x + PAD}" y="${y + ROW_HEIGHT - PAD - 6}" font-size="84" font-weight="600" letter-spacing="-2" fill="${theme.accent}">${escape(tile.value)}</text>`
        : barRows(theme, tile, x, y, width);
    return `<rect x="${x}" y="${y}" width="${width}" height="${ROW_HEIGHT}" rx="20" fill="${theme.tile}"/>${title}${content}`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" role="img" ${FONT}>
<title>${escape(tiles.map(describe).join("; "))}</title>
<rect width="${WIDTH}" height="${height}" fill="${theme.surface}"/>
${body.join("\n")}
</svg>
`;
};

const [specPath, outputPrefix] = process.argv.slice(2);
if (!specPath || !outputPrefix) throw new Error("Usage: bun bento-chart.ts <spec.json> <output-prefix>");
const tiles = JSON.parse(readFileSync(specPath, "utf8")) as Tile[];
for (const [mode, theme] of Object.entries(THEMES)) writeFileSync(`${outputPrefix}-${mode}.svg`, render(theme, tiles));
console.log(tiles.map(describe).join("\n"));
