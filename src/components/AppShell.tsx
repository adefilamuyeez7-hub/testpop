import { NavLink, Outlet, useLocation } from "react-router-dom";

const consumerTabs = [
  { to: "/", label: "Feed", icon: "Home", match: ["/"] },
  { to: "/marketplace", label: "Explore", icon: "Search", match: ["/discover", "/marketplace"] },
  { to: "/create", label: "Create", icon: "Plus", match: ["/create"] },
  { to: "/library", label: "Library", icon: "Bag", match: ["/library"] },
  { to: "/creator/nora-vale", label: "Profile", icon: "User", match: ["/creator"] },
];

const creatorTabs = [
  { to: "/profile", label: "Dashboard", icon: "Home", match: ["/profile"] },
  { to: "/products", label: "Products", icon: "Bag", match: ["/products"] },
  { to: "/create", label: "Create", icon: "Plus", match: ["/create"] },
  { to: "/analytics", label: "Analytics", icon: "Bars", match: ["/analytics"] },
  { to: "/more", label: "More", icon: "Menu", match: ["/more"] },
];

function matchesPath(pathname: string, matchers: string[]) {
  return matchers.some((matcher) => pathname === matcher || pathname.startsWith(`${matcher}/`));
}

export function AppShell() {
  const location = useLocation();
  const isCreatorArea = matchesPath(location.pathname, ["/profile", "/products", "/analytics", "/more"]);
  const tabs = isCreatorArea ? creatorTabs : consumerTabs;

  return (
    <div className={`app-shell ${isCreatorArea ? "app-shell--creator" : "app-shell--consumer"}`}>
      <main className="app-shell__body">
        <Outlet />
      </main>
      <nav className={`bottom-nav ${isCreatorArea ? "bottom-nav--creator" : ""}`} aria-label="Primary">
        {tabs.map((tab) => {
          const active = matchesPath(location.pathname, tab.match);

          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === "/"}
              className={active ? "bottom-nav__item bottom-nav__item--active" : "bottom-nav__item"}
            >
              <span className={`bottom-nav__icon bottom-nav__icon--${tab.icon.toLowerCase()}`} aria-hidden="true" />
              <span>{tab.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
