import type { ReactNode } from "react";
import { I18nProvider } from "react-aria-components";

interface LocaleProviderProps {
  readonly locale: string;
  readonly children: ReactNode;
}

export function LocaleProvider({ locale, children }: Readonly<LocaleProviderProps>): ReactNode {
  return <I18nProvider locale={locale}>{children}</I18nProvider>;
}
