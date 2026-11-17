import { Box } from "@chakra-ui/react";
import { DataTable, type DataTableProps, type RowData } from ".";

export default {
  title: "Design system/Components/Data display/Data table/Image columns",
  fullscreen: true,
  description: "Image cells with single photos, galleries, round logos and a broken image. Synthetic data only.",
};

// Synthetic images: inline SVG swatches so frames work offline.
const swatch = (label: string, background: string, round = false) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="${round ? 48 : 10}" fill="${background}"/><text x="48" y="58" font-family="sans-serif" font-size="30" font-weight="700" fill="white" text-anchor="middle">${label}</text></svg>`,
  )}`;

const products: RowData[] = [
  {
    Product: "Trail running shoe",
    Photo: { src: swatch("TR", "#2f855a"), alt: "Trail running shoe, side view" },
    Gallery: [swatch("1", "#2f855a"), swatch("2", "#276749"), swatch("3", "#22543d"), swatch("4", "#1c4532")],
    Brand: { src: swatch("N", "#1a202c", true), alt: "Northline" },
    Price: 129,
  },
  {
    Product: "Insulated bottle",
    Photo: { src: swatch("IB", "#2b6cb0"), alt: "Insulated bottle, front" },
    Gallery: [swatch("1", "#2b6cb0"), swatch("2", "#2c5282")],
    Brand: { src: swatch("A", "#c05621", true), alt: "Arcadia" },
    Price: 34,
  },
  {
    Product: "Rain shell",
    Photo: { src: "https://invalid.example/missing-rain-shell.png", alt: "Rain shell" },
    Gallery: [],
    Brand: { src: swatch("N", "#1a202c", true), alt: "Northline" },
    Price: 189,
  },
  {
    Product: "Merino beanie",
    Photo: null,
    Gallery: [swatch("1", "#9b2c2c")],
    Brand: { src: swatch("K", "#553c9a", true), alt: "Kestrel" },
    Price: 29,
  },
];

const imageRenderers: DataTableProps["columnRenderers"] = {
  Photo: { type: "image" },
  Gallery: { type: "image" },
  Brand: { type: "image", shape: "circle", fit: "contain", showLabel: true },
};

/** Switch row height from the table's Display menu: thumbnails grow with Comfortable and Tall rows. */
export const ImageColumns = {
  description:
    "Photo is one image, Gallery stacks up to three and counts the rest, Brand is a round logo with its alt text. Click a thumbnail for a larger preview; the Rain shell photo shows the broken-image fallback.",
  render: () => (
    <Box width="100%" maxWidth="880px" height="420px" marginX="auto" padding="sm" background="bg">
      <DataTable
        data={products}
        columnRenderers={imageRenderers}
        defaultSettings={{ rowHeight: "comfortable" }}
        toolbarStorageKey="preview-data-table-image-columns"
      />
    </Box>
  ),
};
