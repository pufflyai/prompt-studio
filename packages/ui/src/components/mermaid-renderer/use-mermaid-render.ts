import mermaid from "mermaid";
import { useEffect, useState } from "react";

let mermaidInitialized = false;
let renderSequence = 0;

const initializeMermaid = () => {
  if (mermaidInitialized) {
    return;
  }

  mermaid.initialize({
    startOnLoad: false,
    htmlLabels: true,
    flowchart: {
      htmlLabels: true,
    },
    securityLevel: "antiscript",
    theme: "default",
  });

  mermaidInitialized = true;
};

const nextRenderId = () => {
  renderSequence += 1;
  return `mermaid-${renderSequence}`;
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
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");
  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const renderDiagram = async () => {
      initializeMermaid();
      setIsRendering(true);
      setError("");

      try {
        const result = await mermaid.render(nextRenderId(), code);
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
  }, [code]);

  return { svg, error, isRendering };
};
