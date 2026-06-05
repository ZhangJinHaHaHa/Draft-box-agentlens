import { Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import { useTheme } from "@/app/theme";

export function ThemeToggle(): JSX.Element {
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation("common");

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9 text-muted-foreground hover:text-foreground"
      aria-label={t("theme.label")}
      onClick={toggleTheme}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
