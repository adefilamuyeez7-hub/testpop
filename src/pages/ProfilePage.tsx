import { Link } from "react-router-dom";
import { useDemoWallet } from "../hooks/useDemoWallet";
import { featureCards } from "../data/mockData";

export function ProfilePage() {
  const { address, isConnected, connect } = useDemoWallet();

  const collectionItems = featureCards.slice(0, 6);

  return (
    <section className="screen screen--my-collection">
      <div className="collection-header">
        <div className="collection-header__top">
          <h2>AI-Picks for You</h2>
          <button type="button" className="sort-button" aria-label="Sort">
            ≡
          </button>
        </div>
      </div>

      <div className="collection-grid">
        {collectionItems.map((item, index) => (
          <Link 
            key={item.id} 
            to={`/product/${item.id}`}
            className="collection-item"
            style={{
              "--accent": item.accent,
            } as React.CSSProperties}
          >
            <div 
              className="collection-item__media"
              style={{ background: item.accent }}
            />
            <div className="collection-item__overlay">
              <span className="collection-item__title">{item.title.split(" ")[0]}</span>
            </div>
          </Link>
        ))}
      </div>

      <div className="collection-bottom-nav">
        <button type="button" className="nav-item nav-item--active">
          <span className="nav-icon">⌂</span>
        </button>
        <button type="button" className="nav-item">
          <span className="nav-icon">≡</span>
        </button>
        <button type="button" className="nav-item">
          <span className="nav-icon">❤</span>
        </button>
        <button type="button" className="nav-item">
          <span className="nav-icon">👤</span>
        </button>
      </div>

      {!isConnected && (
        <div className="profile-login-prompt">
          <button type="button" className="ghost-pill" onClick={connect}>
            Connect to view your collection
          </button>
        </div>
      )}

      {isConnected && (
        <div className="collection-info">
          <h3>Your Collection</h3>
          <p>Connected: {address?.slice(0, 10)}...</p>
          <div className="collection-actions">
            <Link to="/discover" className="profile-panel">
              <h3>Browse More</h3>
              <p>Explore new collectibles and creators</p>
            </Link>
            <Link to="/creators" className="profile-panel">
              <h3>Creator Studio</h3>
              <p>Publish your own products and tokens</p>
            </Link>
            <Link to="/marketplace" className="profile-panel">
              <h3>Marketplace</h3>
              <p>Track your trading activity</p>
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
