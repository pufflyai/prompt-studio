import mermaid from "mermaid";
import { useEffect, useState } from "react";
import { getThemePreferenceMode, type ThemePreferenceMode } from "../../utils/apply-theme-preference";
import { useThemePreference } from "../../utils/theme-preference";

let initializedMode: ThemePreferenceMode | null = null;
let renderSequence = 0;
let renderQueue = Promise.resolve();

const getMermaidTheme = (mode: ThemePreferenceMode) => (mode === "dark" ? "dark" : "default");

const initializeMermaid = (mode: ThemePreferenceMode) => {
  if (initializedMode === mode) {
    return;
  }

  mermaid.initialize({
    startOnLoad: false,
    htmlLabels: true,
    flowchart: {
      htmlLabels: true,
    },
    securityLevel: "antiscript",
    theme: getMermaidTheme(mode),
  });

  initializedMode = mode;
};

const nextRenderId = () => {
  renderSequence += 1;
  return `mermaid-${renderSequence}`;
};

const renderMermaidDiagram = (mode: ThemePreferenceMode, code: string) => {
  const render = async () => {
    // Mermaid keeps render config in a shared singleton, so theme changes must not overlap renders.
    initializeMermaid(mode);
    return mermaid.render(nextRenderId(), code);
  };

  const queuedRender = renderQueue.then(render, render);
  renderQueue = queuedRender.then(
    () => undefined,
    () => undefined,
  );

  return queuedRender;
};

const formatMermaidError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return "Failed to render Mermaid diagram.";
  }

  const message = error.message.trim();
  if (!message) {
    return "Failed to render Mermaid diagram.";
  }

  return message.split("\n").filter(Boolean).slice(0, 3).join("\n");
};

export const useMermaidRender = (code: string) => {
  const { themePreference, themePreferences } = useThemePreference();
  const themeMode = getThemePreferenceMode(themePreference, themePreferences);
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");
  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const renderDiagram = async () => {
      setIsRendering(true);
      setError("");

      try {
        const result = await renderMermaidDiagram(themeMode, code);
        if (cancelled) {
          return;
        }

        setSvg(result.svg);
      } catch (renderError) {
        if (cancelled) {
          return;
        }

        setSvg("");
        setError(formatMermaidError(renderError));
      } finally {
        if (!cancelled) {
          setIsRendering(false);
        }
      }
    };

    void renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [code, themeMode]);

  return { svg, error, isRendering };
};
