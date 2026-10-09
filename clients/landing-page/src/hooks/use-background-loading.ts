import { useEffect } from "react";
import { loadAnalytics } from "../services/analytics";
import { loadInBackground } from "../services/background-loading";
import { BACKGROUND_MODULES } from "../services/landing-modules";

export const useBackgroundLoading = () => {
  useEffect(() => loadInBackground([loadAnalytics, ...BACKGROUND_MODULES.map((module) => module.preload)]), []);
};
