import { useNavigate } from "react-router-dom";
import { useDemoWallet } from "../hooks/useDemoWallet";

export function MobileHeader() {
  const navigate = useNavigate();
  const { address, isConnected, connect, disconnect } = useDemoWallet();

  return (
    <header className="mobile-header">
      <button type="button" className="brand-lockup" onClick={() => navigate("/")}>
        <p className="eyebrow">Onchain discovery</p>
        <h1 className="brand">POPUP</h1>
      </button>
      <button
        className="ghost-button"
        type="button"
        onClick={isConnected ? disconnect : connect}
      >
        {isConnected ? address : "Connect"}
      </button>
    </header>
  );
}
