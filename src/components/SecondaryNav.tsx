/**
 * Secondary Navigation Menu
 * Location: src/components/SecondaryNav.tsx
 *
 * Profile-only navigation for marketplace, collection, and creator sections.
 */

import { useLocation } from "react-router-dom";
import { secondaryNavItems } from "./appShellNav";
import { NavLink } from "./NavLink";

export function SecondaryNav() {
  const location = useLocation();

  return (
    <nav className="border-t border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-3 py-3 sm:px-4 lg:px-6">
        {secondaryNavItems.map((section) => (
          <div
            key={section.section}
            className="rounded-2xl border border-border/60 bg-background/80 p-3 shadow-sm"
          >
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {section.section}
            </p>
            <div className="flex flex-wrap gap-2">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition-colors ${
                      isActive
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background text-foreground hover:border-foreground/30 hover:bg-secondary"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}

export default SecondaryNav;
