// @ts-expect-error Bun supports text imports for bundled runtime assets.
import runtimeScript from "./runtime.bundle.js" with { type: "text" };

const MOUNT_ID = "pstdio-extension-mount";

const escapeAttribute = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");

export const renderExtensionRuntimeHtml = (scriptUrl: string) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body {
        height: 100%;
        margin: 0;
        background: transparent;
      }
      #${MOUNT_ID} {
        height: 100%;
        width: 100%;
        display: block;
        min-height: 0;
      }
    </style>
  </head>
  <body>
    <div id="${MOUNT_ID}"></div>
    <script type="module" src="${escapeAttribute(scriptUrl)}"></script>
  </body>
</html>
`;

export const getExtensionRuntimeScript = () => runtimeScript;
