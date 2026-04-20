import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getTokenById } from "../data/mockData";

export function MarketplaceTokenPage() {
  const { tokenId } = useParams();
  const navigate = useNavigate();
  const token = getTokenById(tokenId ?? "");
  const [activeTab, setActiveTab] = useState("overview");

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

  const filteredListings =
    activeTab === "overview"
      ? token.listings.slice(0, 3)
      : activeTab === "all"
        ? token.listings
        : activeTab === "best"
          ? [...token.listings].sort((a, b) => a.ask.localeCompare(b.ask))
          : token.listings.slice(0, 1);

  return (
    <section className="screen screen--token-report">
      <div className="token-report-header">
        <button type="button" className="report-back-btn" onClick={() => navigate(-1)}>
          Back
        </button>
        <h1 className="report-title">{token.token} market</h1>
        <button type="button" className="report-settings-btn" onClick={() => navigate("/marketplace")}>
          All
        </button>
      </div>

      <div className="report-card" style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}>
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
          <div className="chart-placeholder">Trend</div>
        </div>

        <div className="report-details">
          <div className="report-detail-row">
            <span className="report-detail-label">Liquidity</span>
            <span className="report-detail-value">{token.liquidity}</span>
          </div>
          <div className="report-detail-row">
            <span className="report-detail-label">Holders</span>
            <span className="report-detail-value">{token.holders}</span>
          </div>
        </div>
      </div>

      <div className="activities-section">
        <h3 className="activities-title">Recent activity</h3>

        <div className="activities-list">
          {token.listings.slice(0, 4).map((listing, idx) => (
            <div key={idx} className={`activity-item ${idx === 1 ? "activity-item--highlighted" : ""}`}>
              <div className="activity-icon">{idx === 0 ? "New" : idx === 1 ? "Hot" : idx === 2 ? "Bid" : "Move"}</div>
              <div className="activity-content">
                <h4 className="activity-name">{listing.collector}</h4>
                <p className="activity-meta">{listing.pieces}</p>
              </div>
              <div className="activity-price">{token.floor}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="token-tabs">
        <button
          type="button"
          className={`token-tab ${activeTab === "overview" ? "token-tab--active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </button>
        <button
          type="button"
          className={`token-tab ${activeTab === "all" ? "token-tab--active" : ""}`}
          onClick={() => setActiveTab("all")}
        >
          All listings
        </button>
        <button
          type="button"
          className={`token-tab ${activeTab === "best" ? "token-tab--active" : ""}`}
          onClick={() => setActiveTab("best")}
        >
          Best asks
        </button>
        <button
          type="button"
          className={`token-tab ${activeTab === "you" ? "token-tab--active" : ""}`}
          onClick={() => setActiveTab("you")}
        >
          Your side
        </button>
      </div>

      <div className="token-listings">
        <div className="listings-grid">
          {filteredListings.map((listing, idx) => (
            <article key={`${token.id}-${listing.collector}-${idx}`} className="p2p-listing-card">
              <div className="p2p-listing-header">
                <div className="p2p-seller-info">
                  <div className="p2p-seller-avatar">{listing.collector.charAt(0).toUpperCase()}</div>
                  <div className="p2p-seller-details">
                    <span className="p2p-seller-name">{listing.collector}</span>
                    <span className="p2p-seller-fragments">{listing.pieces}</span>
                  </div>
                </div>
                <span className="p2p-ask-price">{listing.ask}</span>
              </div>

              <div className="p2p-listing-meta">
                <span className="p2p-meta-label">Peer-to-peer</span>
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
