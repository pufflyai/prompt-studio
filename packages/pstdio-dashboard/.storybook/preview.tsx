import { ChakraProvider, getInitialThemePreference, psTheme, ThemePreferenceProvider } from "@pstdio/ui";
import { withThemeByClassName } from "@storybook/addon-themes";
import type { Preview } from "@storybook/react-vite";
import { type ReactNode, useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "../src/i18n/config";

const initialThemePreference = getInitialThemePreference();
const storybookLocales = [
  { value: "browser", title: "Browser" },
  { value: "en", title: "English" },
  { value: "fr", title: "Francais" },
  { value: "ja", title: "Japanese" },
  { value: "es", title: "Spanish" },
  { value: "ko", title: "Korean" },
  { value: "zh-Hans", title: "Chinese (Simplified)" },
  { value: "zh-Hant", title: "Chinese (Traditional)" },
] as const;

const resolveLocale = (locale: string) =>
  locale === "browser" ? (navigator.languages?.[0] ?? navigator.language) : locale;

const StorybookProviders = (props: { children: ReactNode; locale: string }) => {
  const { children, locale } = props;

  useEffect(() => {
    const nextLocale = resolveLocale(locale);
    document.documentElement.lang = nextLocale;
    void i18n.changeLanguage(nextLocale);
  }, [locale]);

  return (
    <I18nextProvider i18n={i18n}>
      <ThemePreferenceProvider initialPreference={initialThemePreference}>
        <ChakraProvider value={psTheme}>{children}</ChakraProvider>
      </ThemePreferenceProvider>
    </I18nextProvider>
  );
};

const preview: Preview = {
  globalTypes: {
    locale: {
      name: "Locale",
      description: "Dashboard locale",
      defaultValue: "browser",
      toolbar: {
        icon: "globe",
        dynamicTitle: true,
        items: storybookLocales,
      },
    },
  },
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  decorators: [
    (Story, context) => (
      <StorybookProviders locale={String(context.globals.locale ?? "browser")}>
        <Story />
      </StorybookProviders>
    ),
    withThemeByClassName({
      defaultTheme: "light",
      themes: { light: "", dark: "dark" },
    }),
  ],
};

export default preview;
