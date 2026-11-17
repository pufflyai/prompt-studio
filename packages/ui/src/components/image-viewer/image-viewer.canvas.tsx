import { chakra, HStack, Image, Stack, Text } from "@chakra-ui/react";
import { ImageViewer } from "./image-viewer";

export default {
  title: "Design system/Components/Data display/Image viewer",
  description: "The shared image popover: no padding, one image or a carousel. Synthetic images only.",
};

const swatch = (label: string, background: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420"><rect width="640" height="420" fill="${background}"/><text x="320" y="240" font-family="sans-serif" font-size="96" font-weight="700" fill="white" text-anchor="middle">${label}</text></svg>`,
  )}`;

const gallery = [
  { src: swatch("Side", "#2f855a"), alt: "Trail shoe, side view" },
  { src: swatch("Front", "#2b6cb0"), alt: "Trail shoe, front" },
  { src: swatch("Sole", "#9c4221"), alt: "Trail shoe, sole" },
  { src: "https://invalid.example/missing.png", alt: "Box" },
];

/** Click a thumbnail: one opens a single image, the others open the carousel at that image. */
export const Thumbnails = () => (
  <Stack gap="md" padding="md">
    <Text textStyle="label/S/medium">Single image</Text>
    <ImageViewer images={[gallery[0]!]}>
      <chakra.button type="button" aria-label="View side view" width="fit-content">
        <Image src={gallery[0]!.src} alt="" boxSize="64px" borderRadius="sm" objectFit="cover" />
      </chakra.button>
    </ImageViewer>
    <Text textStyle="label/S/medium">Gallery (drag, or use the side buttons)</Text>
    <HStack gap="xs">
      {gallery.map((image, index) => (
        <ImageViewer key={image.alt} images={gallery} initialIndex={index}>
          <chakra.button type="button" aria-label={`View ${image.alt}`}>
            <Image src={image.src} alt="" boxSize="64px" borderRadius="sm" objectFit="cover" bg="bg.muted" />
          </chakra.button>
        </ImageViewer>
      ))}
    </HStack>
  </Stack>
);
