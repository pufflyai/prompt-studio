import { useEffect, useState } from "react";
import { fetchDesktopRelease } from "../services/desktop-releases";
import { type DesktopRelease, preferredDownload } from "../services/release-assets";

export const useDesktopDownloads = () => {
  const [release, setRelease] = useState<DesktopRelease>();
  const [selectedId, setSelectedId] = useState<string>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchDesktopRelease(controller.signal)
      .then((result) => {
        setRelease(result);
        setSelectedId(preferredDownload(result.downloads, navigator.userAgent, navigator.maxTouchPoints)?.id);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, []);

  const selected = release?.downloads.find((download) => download.id === selectedId);
  return { release, selected, failed, selectDownload: setSelectedId };
};
