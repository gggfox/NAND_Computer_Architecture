import type { ReactNode } from "react";

import { getLocale, locales, setLocale } from "~/i18n/locale";
import type { Locale } from "~/i18n/locale";
import { m } from "~/i18n/paraglide/messages";

import { Select } from "./Select";

const localeLabels: Readonly<Record<Locale, () => string>> = {
  en: () => m.language_en(),
  es: () => m.language_es(),
};

function isLocale(value: string): value is Locale {
  return locales.some((locale) => locale === value);
}

export function LanguagePicker(): ReactNode {
  const options = locales.map((locale) => ({ id: locale, label: localeLabels[locale]() }));

  return (
    <Select
      label={m.language_label()}
      options={options}
      value={getLocale()}
      onChange={(key) => {
        if (isLocale(key)) {
          void setLocale(key);
        }
      }}
    />
  );
}
