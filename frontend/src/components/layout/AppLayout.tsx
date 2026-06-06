import { Outlet } from "react-router-dom";

import { Footer } from "./Footer";
import { NavHeader } from "./NavHeader";

export function AppLayout(): JSX.Element {
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
