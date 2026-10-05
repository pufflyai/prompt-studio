import { useEffect, useState } from "react";
import type { LandingDocument, LandingPage } from "../content/landing-pages";
import { isDocumentPage } from "../services/landing-route";

const documentUrl = (path: string) => `/documents${path.slice(0, -1)}.json`;

/**
 * Loads the HTML of document pages on navigation. Until it arrives, the previous
 * page stays on screen, so nothing moves while the next document loads.
 */
export const useLandingDocument = (page: LandingPage, initialDocument: LandingDocument | undefined) => {
  const [documents, setDocuments] = useState(() => new Map(initialDocument ? [[page.path, initialDocument]] : []));
  const [shownPage, setShownPage] = useState(page);
  const ready = !isDocumentPage(page) || documents.has(page.path);
  if (ready && shownPage !== page) setShownPage(page);

  useEffect(() => {
    if (ready) return;
    const controller = new AbortController();
    fetch(documentUrl(page.path), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        return response.json() as Promise<LandingDocument>;
      })
      .then((document) => setDocuments((loaded) => new Map(loaded).set(page.path, document)))
      .catch(() => {
        // The static page always works, so a failed fetch falls back to loading it.
        if (!controller.signal.aborted) window.location.reload();
      });
    return () => controller.abort();
  }, [page.path, ready]);

  return { shownPage, document: documents.get(shownPage.path), loading: !ready };
};
