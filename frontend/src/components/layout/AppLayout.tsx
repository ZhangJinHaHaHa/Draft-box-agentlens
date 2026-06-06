import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { Footer } from "./Footer";
import { NavHeader } from "./NavHeader";

export function AppLayout(): JSX.Element {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) return;

    const id = decodeURIComponent(location.hash.slice(1));
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ block: "start" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [location.hash, location.pathname]);

  return (
    <div className="relative isolate flex min-h-screen flex-col text-foreground">
      <div className="art-backdrop" aria-hidden="true" />
      <div className="art-backdrop-glass" aria-hidden="true" />

      <NavHeader />
      <main className="flex-1 relative z-10">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
