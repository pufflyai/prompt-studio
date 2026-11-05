import "@pstdio/ui/style.css";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createInstance } from "i18next";
import { type ReactNode, useState } from "react";
import { I18nextProvider } from "react-i18next";
import en from "../l10n/en.json";
import es from "../l10n/es.json";
import fr from "../l10n/fr.json";
import ja from "../l10n/ja.json";
import ko from "../l10n/ko.json";
import zhHans from "../l10n/zh-Hans.json";
import zhHant from "../l10n/zh-Hant.json";

export const SetupProvider = ({ children, language = "en" }: { children: ReactNode; language?: string }) => {
  const [queryClient] = useState(() => new QueryClient());
  const [i18n] = useState(() => {
    const instance = createInstance();
    void instance.init({
      lng: language,
      fallbackLng: "en",
      initImmediate: false,
      interpolation: { escapeValue: false },
      resources: Object.fromEntries(
        Object.entries({ en, es, fr, ja, ko, "zh-Hans": zhHans, "zh-Hant": zhHant }).map(([key, common]) => [
          key,
          { common },
        ]),
      ),
    });
    return instance;
  });
  return (
    <ChakraProvider value={psTheme}>
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </I18nextProvider>
    </ChakraProvider>
  );
};
