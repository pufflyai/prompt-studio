import { join } from "node:path";
import { chromium, type Page } from "@playwright/test";

const assetsRoot = join(import.meta.dirname, "../assets");
const pngSizes = [48, 72, 96, 144, 192, 256, 384, 512];
const windowsSizes = [16, 32, 48, 256];
const macSizes = {
  icp4: 16,
  icp5: 32,
  icp6: 64,
  ic07: 128,
  ic08: 256,
  ic09: 512,
  ic10: 1024,
  ic11: 32,
  ic12: 64,
  ic13: 256,
  ic14: 512,
};
const renderIcon = async (page: Page, filename: string, sizes: number[]) => {
  const svg = await Bun.file(join(assetsRoot, filename)).text();
  const images = new Map<number, Buffer>();
  for (const size of new Set(sizes)) {
    const png = await page.evaluate(
      async ({ svg, size }) => {
        const image = new Image();
        image.src = `data:image/svg+xml;base64,${btoa(svg)}`;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        canvas.getContext("2d")!.drawImage(image, 0, 0, size, size);
        return canvas.toDataURL("image/png").split(",")[1];
      },
      { svg, size },
    );
    images.set(size, Buffer.from(png, "base64"));
  }
  return images;
};

const browser = await chromium.launch();
let images: Map<number, Buffer>;
let macImages: Map<number, Buffer>;
try {
  const page = await browser.newPage();
  images = await renderIcon(page, "icon.svg", [...pngSizes, ...windowsSizes]);
  macImages = await renderIcon(page, "icon-mac.svg", Object.values(macSizes));
} finally {
  await browser.close();
}

await Bun.write(join(assetsRoot, "icon.png"), images.get(512)!);
for (const size of pngSizes) {
  await Bun.write(join(assetsRoot, `icons/icon-${size}x${size}.png`), images.get(size)!);
}

// Embed PNGs so Windows keeps the same transparent edges as the other formats.
const directory = Buffer.alloc(6 + windowsSizes.length * 16);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(windowsSizes.length, 4);
let offset = directory.length;
for (const [index, size] of windowsSizes.entries()) {
  const png = images.get(size)!;
  const entry = 6 + index * 16;
  directory[entry] = size % 256;
  directory[entry + 1] = size % 256;
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(png.length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += png.length;
}
await Bun.write(
  join(assetsRoot, "icon.ico"),
  Buffer.concat([directory, ...windowsSizes.map((size) => images.get(size)!)]),
);

const chunks = Object.entries(macSizes).map(([type, size]) => {
  const png = macImages.get(size)!;
  const header = Buffer.alloc(8);
  header.write(type);
  header.writeUInt32BE(png.length + header.length, 4);
  return Buffer.concat([header, png]);
});
const header = Buffer.alloc(8);
header.write("icns");
header.writeUInt32BE(header.length + chunks.reduce((total, chunk) => total + chunk.length, 0), 4);
await Bun.write(join(assetsRoot, "icon.icns"), Buffer.concat([header, ...chunks]));
console.log("Generated desktop PNG and ICO from icon.svg, and ICNS from icon-mac.svg.");
