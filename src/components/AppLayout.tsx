import { Outlet } from "react-router-dom";
import TopBar from "./TopBar";
import BottomNav from "./BottomNav";

const AppLayout = () => {
  return (
    <div className="min-h-screen-safe bg-background max-w-lg mx-auto relative safe-top safe-bottom">
      <TopBar />
      <main className="pb-16 md:pb-20">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
};

export default AppLayout;
