import { Outlet } from "react-router-dom";
import TopBar from "./TopBar";
import BottomNav from "./BottomNav";

const AppLayout = () => {
  return (
    <div className="min-h-screen-safe bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.16),_transparent_30%),linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(239,246,255,0.92)_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.22),_transparent_28%),linear-gradient(180deg,_rgba(2,6,23,0.98)_0%,_rgba(15,23,42,0.96)_100%)]">
      <TopBar />
      <main className="mx-auto w-full max-w-6xl px-0 pb-20 sm:px-2 md:px-4 md:pb-8 lg:px-6">
        <div className="pt-0 md:pt-6 lg:pt-8">
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  );
};

export default AppLayout;
