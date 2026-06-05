import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import { useLocale } from "@/i18n/useLocale";

import { LanguageSwitcher } from "./LanguageSwitcher";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

const NAV_ITEMS = [
  { key: "agents", to: "/agents" }
] as const;

export function NavHeader(): JSX.Element {
  const { t } = useTranslation("common");
  const { buildPath } = useLocale();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container-page flex h-14 items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden items-center gap-1 text-sm md:flex">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.key}
                to={buildPath(item.to)}
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground",
                    isActive && "text-foreground"
                  )
                }
              >
                {t(`nav.${item.key}`)}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
