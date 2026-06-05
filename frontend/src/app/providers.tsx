import * as React from "react";
import { I18nextProvider } from "react-i18next";

import i18n from "@/i18n/config";
import { TooltipProvider } from "@/components/ui/tooltip";

import { ThemeProvider } from "./theme";

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps): JSX.Element {
  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
      </ThemeProvider>
    </I18nextProvider>
  );
}
