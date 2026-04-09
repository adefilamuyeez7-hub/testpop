import { Link, useLocation } from "react-router-dom";
import { appShellNavItems, isAppShellNavActive } from "./appShellNav";

const BottomNav = () => {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/80 backdrop-blur-xl safe-bottom md:hidden">
      <div className="mx-auto flex h-16 max-w-md items-center justify-between gap-1 px-2 pb-safe">
        {appShellNavItems.map((item) => {
          const isActive = isAppShellNavActive(item.path, location.pathname);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-center transition-all ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <item.icon className={`mx-auto h-4 w-4 ${isActive ? "stroke-[2.5]" : ""}`} />
              <span className="block truncate text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
