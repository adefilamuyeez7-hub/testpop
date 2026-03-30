import { Home, Flame, Users, ShoppingBag, User } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const navItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Flame, label: "Drops", path: "/drops" },
  { icon: Users, label: "Artists", path: "/artists" },
  { icon: ShoppingBag, label: "Market", path: "/invest" },
  { icon: User, label: "Profile", path: "/profile" },
];

const BottomNav = () => {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border safe-bottom">
      <div className="flex items-center justify-around h-14 md:h-16 max-w-lg mx-auto px-2 pb-safe">
        {navItems.map((item) => {
          // Support multiple paths for Market (both /invest and /products routes)
          const isActive = location.pathname === item.path ||
            (item.path === "/invest" && (location.pathname.startsWith("/invest") || location.pathname.startsWith("/products") || location.pathname.startsWith("/cart") || location.pathname.startsWith("/checkout") || location.pathname.startsWith("/orders")));
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-0.5 px-2 md:px-3 py-1.5 rounded-xl transition-all ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <item.icon className={`h-4 w-4 md:h-5 md:w-5 ${isActive ? "stroke-[2.5]" : ""}`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
