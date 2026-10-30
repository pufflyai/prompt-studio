interface MonacoEnvironment {
  getWorkerUrl: (moduleId: string, label: string) => string;
  getWorker?: (moduleId: string, label: string) => Promise<Worker>;
}

// Monaco's public worker factory creates URLs in the consuming opaque document,
// just as the preview bootstrap does for its other compiled modules.
export const installCanvasMonacoWorkers = (environment: MonacoEnvironment) => {
  const urls = new Map<string, Promise<string>>();
  environment.getWorker = async (moduleId, label) => {
    const source = environment.getWorkerUrl(moduleId, label);
    let url = urls.get(source);
    if (!url) {
      url = fetch(source)
        .then((response) => response.blob())
        .then((blob) => URL.createObjectURL(blob));
      urls.set(source, url);
    }
    // These prebuilt workers are classic scripts; module workers from blob URLs
    // cannot start in an opaque preview document.
    return new Worker(await url, { type: "classic", name: label });
  };
};
