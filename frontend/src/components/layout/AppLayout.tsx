import { Outlet } from "react-router-dom";

import { Footer } from "./Footer";
import { NavHeader } from "./NavHeader";

export function AppLayout(): JSX.Element {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <NavHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
