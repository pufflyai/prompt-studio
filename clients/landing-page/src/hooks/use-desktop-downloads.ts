import { useEffect, useState } from "react";
import { loadDesktopRelease } from "../services/desktop-releases";
import { type DesktopRelease, preferredDownload } from "../services/release-assets";

// `astro build` replaces this with the latest desktop release it found, or null. Dev servers leave it undefined.
declare const __DESKTOP_RELEASE__: DesktopRelease | null | undefined;
const SNAPSHOT = (typeof __DESKTOP_RELEASE__ === "undefined" ? undefined : __DESKTOP_RELEASE__) ?? undefined;

export const useDesktopDownloads = () => {
  const [release, setRelease] = useState<DesktopRelease>();
  const [selectedId, setSelectedId] = useState<string>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const show = (result: DesktopRelease) => {
      setRelease(result);
      setSelectedId(
        (current) => current ?? preferredDownload(result.downloads, navigator.userAgent, navigator.maxTouchPoints)?.id,
      );
    };
    // The platform is only known in the browser, so the build snapshot is shown after hydration.
    if (SNAPSHOT) show(SNAPSHOT);
    const controller = new AbortController();
    loadDesktopRelease({ snapshot: SNAPSHOT, signal: controller.signal })
      .then(show)
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, []);

  const selected = release?.downloads.find((download) => download.id === selectedId);
  return { release, selected, failed, selectDownload: setSelectedId };
};
