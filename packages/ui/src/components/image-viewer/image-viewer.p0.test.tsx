import { expect, test } from "bun:test";
import { ChakraProvider } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { psTheme } from "@/theme";
import { ImageViewer, ImageViewerContent } from "./image-viewer";

const markup = (node: ReactNode) => renderToStaticMarkup(<ChakraProvider value={psTheme}>{node}</ChakraProvider>);

test("a single image shows without carousel controls, captioned by its alt text", () => {
  const html = markup(<ImageViewerContent images={[{ src: "a.png", alt: "Trail shoe" }]} />);
  expect(html).toContain('src="a.png"');
  expect(html).toContain("Trail shoe");
  expect(html).not.toContain("Next image");
});

test("several images become a carousel with previous and next controls", () => {
  const images = ["Side", "Front", "Back"].map((alt, index) => ({ src: `${index}.png`, alt }));
  const html = markup(<ImageViewerContent images={images} initialIndex={1} />);
  expect(html).toContain('aria-label="Previous image"');
  expect(html).toContain('aria-label="Next image"');
  for (const image of images) expect(html).toContain(`src="${image.src}"`);
});

test("without images the trigger renders on its own", () => {
  const html = markup(
    <ImageViewer images={[]}>
      <button type="button">Thumbnail</button>
    </ImageViewer>,
  );
  expect(html).toContain("Thumbnail");
  expect(html).not.toContain("image-viewer");
});
