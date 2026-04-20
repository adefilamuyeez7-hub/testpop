import { useState } from "react";
import { Link } from "react-router-dom";
import { useDemoWallet } from "../hooks/useDemoWallet";
import { useCollections } from "../hooks/useCollections";
import { featureCards } from "../data/mockData";

export function ProfilePage() {
  const { address, isConnected, connect, disconnect } = useDemoWallet();
  const { collectedItems } = useCollections();
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  const collected = featureCards.filter((item) => collectedItems.includes(item.id));
  const activeItem = collected.find((item) => item.id === activeItemId) ?? collected[0];

  const getAccessLabel = (type: string) => {
    if (type === "PDF") return "Read now";
    if (type === "Image") return "View now";
    return "Download";
  };

  return (
    <section className="screen screen--profile">
      {!isConnected ? (
        <div className="profile-login-section">
          <div className="profile-login-content">
            <h2>Your Collection</h2>
            <p className="profile-login-text">Connect your wallet to view and manage your collection.</p>
            <button type="button" className="cta-button cta-button--primary" onClick={connect}>
              Connect Wallet
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="profile-header">
            <div className="profile-header__info">
              <h2>Your Collection</h2>
              <p className="profile-address">Connected: {address}</p>
            </div>
          </div>

          {collected.length === 0 ? (
            <div className="empty-collection">
              <div className="empty-state">
                <h3>No items collected yet</h3>
                <p>Start collecting digital products from creators on POPUP</p>
                <Link to="/discover" className="cta-button cta-button--primary">
                  Browse Products
                </Link>
              </div>
            </div>
          ) : (
            <>
              {activeItem && (
                <div className="owned-access-panel">
                  <p className="eyebrow">Ready to use</p>
                  <h3>{activeItem.title}</h3>
                  <p>{activeItem.summary}</p>
                  <div className="owned-access-panel__actions">
                    <Link to={`/product/${activeItem.id}`} className="cta-button cta-button--primary">
                      {getAccessLabel(activeItem.type)}
                    </Link>
                    <Link to={`/creator/${activeItem.creatorId}`} className="cta-button cta-button--secondary">
                      View creator
                    </Link>
                  </div>
                </div>
              )}

              <div className="collection-stats">
                <div className="stat-card">
                  <span className="stat-label">Total Items</span>
                  <span className="stat-value">{collected.length}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Unique Creators</span>
                  <span className="stat-value">{new Set(collected.map((c) => c.creatorId)).size}</span>
                </div>
              </div>

              <div className="collection-section">
                <h3>Collected Items</h3>
                <div className="collection-grid">
                  {collected.map((item) => (
                    <Link
                      key={item.id}
                      to={`/product/${item.id}`}
                      className="collection-item"
                      onMouseEnter={() => setActiveItemId(item.id)}
                      onFocus={() => setActiveItemId(item.id)}
                      onClick={() => setActiveItemId(item.id)}
                      style={
                        {
                          "--accent": item.accent,
                        } as React.CSSProperties
                      }
                    >
                      <div className="collection-item__media" style={{ background: item.accent }} />
                      <div className="collection-item__overlay">
                        <div>
                          <span className="collection-item__type">{item.type}</span>
                          <span className="collection-item__title">{item.title}</span>
                          <span className="collection-item__creator">{item.creator}</span>
                          <span className="collection-item__action">{getAccessLabel(item.type)}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}

      <div className="profile-actions">
        <Link to="/discover" className="profile-panel">
          <h3>Browse more</h3>
          <p>Discover new products and creators</p>
        </Link>
        <Link to="/marketplace" className="profile-panel">
          <h3>Marketplace</h3>
          <p>Trade creator tokens</p>
        </Link>
        <Link to="/creators" className="profile-panel">
          <h3>Creators</h3>
          <p>Browse creator profiles and live drops</p>
        </Link>
      </div>

      {isConnected && (
        <div className="profile-footer">
          <button type="button" className="link-button" onClick={disconnect}>
            Disconnect wallet
          </button>
        </div>
      )}
    </section>
  );
}
