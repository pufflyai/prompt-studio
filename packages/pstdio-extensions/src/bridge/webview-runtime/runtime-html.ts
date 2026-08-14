const MOUNT_ID = "pstdio-extension-mount";

const escapeAttribute = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");

const escapeScriptContent = (value: string) => value.replaceAll("</script", "<\\/script").replaceAll("<!--", "<\\!--");

const renderRuntimeHostDocument = (scriptTag: string) => `<!doctype html>
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
      body {
        overflow-x: hidden !important;
        overflow-y: auto !important;
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
    ${scriptTag}
  </body>
</html>
`;

export const getExtensionRuntimeScriptUrl = () => new URL("./runtime.bundle.js", import.meta.url).href;

export const renderExtensionRuntimeHtml = (scriptUrl: string) =>
  renderRuntimeHostDocument(`<script crossorigin="use-credentials" src="${escapeAttribute(scriptUrl)}"></script>`);

export const renderInlineExtensionRuntimeHtml = (runtimeScript: string) =>
  renderRuntimeHostDocument(`<script>${escapeScriptContent(runtimeScript)}</script>`);
