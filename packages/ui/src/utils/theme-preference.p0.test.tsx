import { afterEach, describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { installMockLocalStorage } from "../test-utils/local-storage";
import { defaultThemePreferences } from "./apply-theme-preference";
import { getInitialThemePreference, ThemePreferenceProvider, useThemePreference } from "./theme-preference";

const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

const installWindow = () => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      matchMedia: () => ({ matches: false }),
    },
  });
};

const ActiveTheme = () => {
  const { themePreference } = useThemePreference();
  return <span>{themePreference}</span>;
};

afterEach(() => {
  if (previousWindow) {
    Object.defineProperty(globalThis, "window", previousWindow);
    return;
  }

  Reflect.deleteProperty(globalThis, "window");
});

describe("getInitialThemePreference", () => {
  test("keeps a stored extension theme before its contribution registers", () => {
    installWindow();
    installMockLocalStorage().setItem("theme-preference", "lab.monokai");

    expect(getInitialThemePreference()).toBe("lab.monokai");
  });
});

describe("ThemePreferenceProvider", () => {
  test("uses a mode default without replacing the global preference", () => {
    installWindow();
    const storage = installMockLocalStorage();
    storage.setItem("theme-preference", "pstdio-dark");
    const markup = renderToStaticMarkup(
      <ThemePreferenceProvider
        preferenceScope="scribble"
        defaultPreference="paper"
        themePreferences={[
          { id: "paper", mode: "light" },
          { id: "ink", mode: "dark" },
          { id: "pstdio-dark", mode: "dark" },
        ]}
      >
        <ActiveTheme />
      </ThemePreferenceProvider>,
    );
    expect(markup).toBe("<span>paper</span>");
    expect(storage.getItem("theme-preference")).toBe("pstdio-dark");
  });

  test("restores an explicit mode preference before its declared default", () => {
    installWindow();
    installMockLocalStorage().setItem("theme-preference:scribble", "ink");
    const markup = renderToStaticMarkup(
      <ThemePreferenceProvider
        preferenceScope="scribble"
        defaultPreference="paper"
        themePreferences={[
          { id: "paper", mode: "light" },
          { id: "ink", mode: "dark" },
        ]}
      >
        <ActiveTheme />
      </ThemePreferenceProvider>,
    );
    expect(markup).toBe("<span>ink</span>");
  });

  test("renders the default theme while waiting for a stored extension theme to register", () => {
    installWindow();
    installMockLocalStorage().setItem("theme-preference", "lab.monokai");

    const markup = renderToStaticMarkup(
      <ThemePreferenceProvider>
        <ActiveTheme />
      </ThemePreferenceProvider>,
    );

    expect(markup).toBe("<span>pstdio-light</span>");
  });

  test("renders after the stored extension theme registers", () => {
    installWindow();
    installMockLocalStorage().setItem("theme-preference", "lab.monokai");

    const markup = renderToStaticMarkup(
      <ThemePreferenceProvider themePreferences={[{ id: "lab.monokai", mode: "dark" }]}>
        <span>Workbench</span>
      </ThemePreferenceProvider>,
    );

    expect(markup).toBe("<span>Workbench</span>");
  });

  test("renders despite a legacy stored preference that will never register", () => {
    installWindow();
    installMockLocalStorage().setItem("theme-preference", "light");

    const markup = renderToStaticMarkup(
      <ThemePreferenceProvider>
        <span>Workbench</span>
      </ThemePreferenceProvider>,
    );

    expect(markup).toBe("<span>Workbench</span>");
  });
});

describe("ThemePreferenceProvider with host storage", () => {
  test("reads and saves the theme through the supplied storage", async () => {
    const { act, create } = await import("react-test-renderer");
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    installWindow();
    const browserStorage = installMockLocalStorage();
    const values = new Map([["theme-preference:scribble", "ink"]]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    let context: ReturnType<typeof useThemePreference> | undefined;
    const CaptureTheme = () => {
      context = useThemePreference();
      return null;
    };

    await act(async () => {
      create(
        <ThemePreferenceProvider
          storage={storage}
          preferenceScope="scribble"
          themePreferences={[
            { id: "paper", mode: "light" },
            { id: "ink", mode: "dark" },
          ]}
        >
          <CaptureTheme />
        </ThemePreferenceProvider>,
      );
    });
    expect(context?.themePreference).toBe("ink");

    await act(async () => context?.setThemePreference("paper"));

    expect(context?.themePreference).toBe("paper");
    expect(values.get("theme-preference:scribble")).toBe("paper");
    expect(browserStorage.length).toBe(0);
  });
});

describe("ThemePreferenceProvider pending theme", () => {
  test("keeps naming the chosen extension theme after showing a fallback, until it registers", async () => {
    const { act, create } = await import("react-test-renderer");
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    installWindow();
    installMockLocalStorage().setItem("theme-preference", "lab.monokai");
    let context: ReturnType<typeof useThemePreference> | undefined;
    const CaptureTheme = () => {
      context = useThemePreference();
      return null;
    };
    const monokai = [...defaultThemePreferences, { id: "lab.monokai", mode: "dark" as const }];

    let renderer: ReturnType<typeof create> | undefined;
    await act(async () => {
      renderer = create(
        <ThemePreferenceProvider>
          <CaptureTheme />
        </ThemePreferenceProvider>,
      );
    });
    expect([context?.themePreference, context?.pendingThemePreference]).toEqual(["pstdio-light", "lab.monokai"]);

    await act(async () => {
      renderer?.update(
        <ThemePreferenceProvider themePreferences={monokai}>
          <CaptureTheme />
        </ThemePreferenceProvider>,
      );
    });
    expect([context?.themePreference, context?.pendingThemePreference]).toEqual(["lab.monokai", null]);
  });
});

describe("ThemePreferenceProvider preview", () => {
  test("shows a previewed theme without saving it, then returns to the chosen theme", async () => {
    const { act, create } = await import("react-test-renderer");
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    installWindow();
    const storage = installMockLocalStorage();
    storage.setItem("theme-preference", "pstdio-dark");
    let context: ReturnType<typeof useThemePreference> | undefined;
    const CaptureTheme = () => {
      context = useThemePreference();
      return null;
    };

    await act(async () => {
      create(
        <ThemePreferenceProvider>
          <CaptureTheme />
        </ThemePreferenceProvider>,
      );
    });
    await act(async () => context?.previewThemePreference("pstdio-light"));

    expect([context?.themePreference, context?.chosenThemePreference]).toEqual(["pstdio-light", "pstdio-dark"]);
    expect(storage.getItem("theme-preference")).toBe("pstdio-dark");

    await act(async () => context?.previewThemePreference(null));

    expect(context?.themePreference).toBe("pstdio-dark");
    expect(storage.getItem("theme-preference")).toBe("pstdio-dark");
  });
});

test("a failed theme write does not restore the old stored choice on a rerender", async () => {
  const { act, create } = await import("react-test-renderer");
  installWindow();
  const storage = installMockLocalStorage();
  storage.setItem("theme-preference", "pstdio-light");
  storage.setItem = () => {
    throw new Error("Storage unavailable");
  };
  let context: ReturnType<typeof useThemePreference>;
  const Probe = () => {
    context = useThemePreference();
    return null;
  };
  let renderer: ReturnType<typeof create>;
  await act(async () => {
    renderer = create(
      <ThemePreferenceProvider>
        <Probe />
      </ThemePreferenceProvider>,
    );
  });
  await act(async () => context.setThemePreference("pstdio-dark"));
  await act(async () =>
    renderer.update(
      <ThemePreferenceProvider>
        <Probe />
      </ThemePreferenceProvider>,
    ),
  );
  expect(context.themePreference).toBe("pstdio-dark");
  expect(storage.getItem("theme-preference")).toBe("pstdio-light");
  await act(async () => renderer.unmount());
});

test("providers sharing host storage share the live choice even after a failed write", async () => {
  const { act, create } = await import("react-test-renderer");
  installWindow();
  installMockLocalStorage();
  const storage = { getItem: () => "pstdio-light", setItem: () => {} };
  const contexts: Record<string, ReturnType<typeof useThemePreference>> = {};
  const Probe = (props: { id: string }) => {
    contexts[props.id] = useThemePreference();
    return null;
  };
  const Scene = (props: { generation: number }) => (
    <>
      <ThemePreferenceProvider storage={storage}>
        <Probe id="a" />
      </ThemePreferenceProvider>
      <ThemePreferenceProvider key={props.generation} storage={storage}>
        <Probe id="b" />
      </ThemePreferenceProvider>
    </>
  );
  let renderer: ReturnType<typeof create>;
  await act(async () => {
    renderer = create(<Scene generation={0} />);
  });
  await act(async () => contexts.a.setThemePreference("pstdio-dark"));
  expect(contexts.b.themePreference).toBe("pstdio-dark");
  await act(async () => renderer.update(<Scene generation={1} />));
  expect(contexts.b.themePreference).toBe("pstdio-dark");
  await act(async () => renderer.unmount());
});

test("explicit initial themes keep their override and publish later user choices", async () => {
  const { act, create } = await import("react-test-renderer");
  installWindow();
  installMockLocalStorage();
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  const contexts: Record<string, ReturnType<typeof useThemePreference>> = {};
  const Probe = (props: { id: string }) => {
    contexts[props.id] = useThemePreference();
    return null;
  };
  let renderer: ReturnType<typeof create>;
  await act(async () => {
    renderer = create(
      <>
        <ThemePreferenceProvider storage={storage} initialPreference="pstdio-dark">
          <Probe id="explicit" />
        </ThemePreferenceProvider>
        <ThemePreferenceProvider storage={storage}>
          <Probe id="shared" />
        </ThemePreferenceProvider>
      </>,
    );
  });
  await act(async () => contexts.shared.setThemePreference("pstdio-light"));
  expect(contexts.explicit.themePreference).toBe("pstdio-dark");
  await act(async () => contexts.explicit.setThemePreference("pstdio-dark"));
  expect(contexts.shared.themePreference).toBe("pstdio-dark");
  await act(async () => renderer.unmount());
});
