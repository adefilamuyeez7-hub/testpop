import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getCreatorById, getTokenById } from "../data/mockData";

export function MarketplaceTokenPage() {
  const { tokenId } = useParams();
  const token = getTokenById(tokenId ?? "");
  const [activeTab, setActiveTab] = useState("home");
  const [selectedHolder, setSelectedHolder] = useState<string | null>(null);

  if (!token) {
    return (
      <section className="screen">
        <div className="profile-panel">
          <h2>Token not found</h2>
          <p>This creator token does not have a visible listing yet.</p>
          <Link to="/marketplace" className="solid-pill">
            Back to marketplace
          </Link>
        </div>
      </section>
    );
  }

  const creator = getCreatorById(token.creatorId);
  const filteredListings = selectedHolder
    ? token.listings.filter(l => l.collector === selectedHolder)
    : activeTab === "home" 
      ? token.listings.slice(0, 3)
      : activeTab === "explore"
        ? token.listings
        : activeTab === "favorite"
          ? token.listings.filter((_, i) => i % 2 === 0)
          : token.listings.filter((_, i) => i % 2 === 1);

  return (
    <section className="screen screen--token-report">
      <div className="token-report-header">
        <button type="button" className="report-back-btn">←</button>
        <h1 className="report-title">Today's Report</h1>
        <button type="button" className="report-settings-btn">⚙️</button>
      </div>

      {/* Report Card */}
      <div className="report-card" style={{ background: `linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)` }}>
        <div className="report-header">
          <span className="report-label">Report</span>
          <span className="report-value">{token.token}</span>
        </div>

        <div className="report-stats">
          <div className="report-stat-item">
            <div className="report-stat-value">{token.floor}</div>
            <div className="report-stat-label">Floor Price</div>
          </div>
          <div className="report-stat-separator"></div>
          <div className="report-stat-item">
            <div className="report-stat-value">{token.change}</div>
            <div className="report-stat-label">24h Change</div>
          </div>
        </div>

        <div className="report-chart">
          <div className="chart-placeholder">📊</div>
        </div>

        <div className="report-details">
          <div className="report-detail-row">
            <span className="report-detail-label">Liquidity</span>
            <span className="report-detail-value">${token.liquidity}</span>
          </div>
          <div className="report-detail-row">
            <span className="report-detail-label">Holders</span>
            <span className="report-detail-value">{token.holders}</span>
          </div>
        </div>
      </div>

      {/* Activities Section */}
      <div className="activities-section">
        <h3 className="activities-title">Activities</h3>

        <div className="activities-list">
          {token.listings.slice(0, 4).map((listing, idx) => (
            <div key={idx} className={`activity-item ${idx === 1 ? "activity-item--highlighted" : ""}`}>
              <div className="activity-icon">
                {idx === 0 ? "✓" : idx === 1 ? "🔥" : idx === 2 ? "⏱" : "💪"}
              </div>
              <div className="activity-content">
                <h4 className="activity-name">{listing.collector}</h4>
                <p className="activity-meta">{listing.pieces}</p>
              </div>
              <div className="activity-price">
                {token.floor}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="token-tabs">
        <button 
          type="button" 
          className={`token-tab ${activeTab === "home" ? "token-tab--active" : ""}`}
          onClick={() => setActiveTab("home")}
        >
          🏠 Home
        </button>
        <button 
          type="button" 
          className={`token-tab ${activeTab === "explore" ? "token-tab--active" : ""}`}
          onClick={() => setActiveTab("explore")}
        >
          🔍 Explore
        </button>
        <button 
          type="button" 
          className={`token-tab ${activeTab === "favorite" ? "token-tab--active" : ""}`}
          onClick={() => setActiveTab("favorite")}
        >
          ❤️ Favorite
        </button>
        <button 
          type="button" 
          className={`token-tab ${activeTab === "account" ? "token-tab--active" : ""}`}
          onClick={() => setActiveTab("account")}
        >
          🔐 Account
        </button>
      </div>

      {/* Listings */}
      <div className="token-listings">
        <div className="listings-grid">
          {filteredListings.map((listing, idx) => (
            <article key={`${token.id}-${listing.collector}-${idx}`} className="p2p-listing-card">
              <div className="p2p-listing-header">
                <div className="p2p-seller-info">
                  <div className="p2p-seller-avatar">
                    {listing.collector.charAt(0).toUpperCase()}
                  </div>
                  <div className="p2p-seller-details">
                    <span className="p2p-seller-name">{listing.collector}</span>
                    <span className="p2p-seller-fragments">{listing.pieces}</span>
                  </div>
                </div>
                <span className="p2p-ask-price">{listing.ask}</span>
              </div>

              <div className="p2p-listing-meta">
                <span className="p2p-meta-label">Peer-to-Peer</span>
                <span className="p2p-meta-value">P2P</span>
              </div>

              <div className="p2p-listing-note">
                <p>{listing.note}</p>
              </div>

              <div className="p2p-listing-actions">
                <button type="button" className="p2p-action-btn p2p-action-btn--secondary">
                  Instant sell
                </button>
                <button type="button" className="p2p-action-btn p2p-action-btn--primary">
                  Buy
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
