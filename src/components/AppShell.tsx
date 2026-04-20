import { NavLink, Outlet } from "react-router-dom";
import { MobileHeader } from "./MobileHeader";

const tabs = [
  { to: "/", label: "Home" },
  { to: "/discover", label: "Discovery" },
  { to: "/marketplace", label: "Marketplace" },
  { to: "/profile", label: "Profile" },
];

export function AppShell() {
  return (
    <div className="app-shell">
      <MobileHeader />
      <main className="app-shell__body">
        <Outlet />
      </main>
      <nav className="bottom-nav" aria-label="Primary">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === "/"}
            className={({ isActive }) =>
              isActive ? "bottom-nav__item bottom-nav__item--active" : "bottom-nav__item"
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
