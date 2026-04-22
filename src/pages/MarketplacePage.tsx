import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getCreatorById, marketplaceCards } from "../data/mockData";

const filters = ["All Tokens", "Trending", "New", "Top Gainers", "Top Volume"];

export function MarketplacePage() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState("All Tokens");

  return (
    <section className="od-page od-market-page">
      <header className="od-topbar">
        <Link to="/" className="od-brand">
          <span className="od-brand__mark" />
          <span>ONCHAIN DISCOVERY</span>
        </Link>
        <div className="od-topbar__actions">
          <button type="button" className="od-icon-button" aria-label="Search">
            <span className="bottom-nav__icon bottom-nav__icon--search" />
          </button>
          <button type="button" className="od-wallet-button" onClick={() => navigate("/library")}>
            Wallet
          </button>
          <button type="button" className="od-icon-button" aria-label="Notifications">
            <span className="od-dot" />
          </button>
        </div>
      </header>

      <section className="od-market-hero">
        <h1>Creator Tokens</h1>
        <p>Discover and invest in creator tokens. Support, earn, and be part of the community.</p>
      </section>

      <div className="od-chip-row">
        {filters.map((filter) => (
          <button
            key={filter}
            type="button"
            className={`od-filter-chip ${filter === activeFilter ? "od-filter-chip--active" : ""}`}
            onClick={() => setActiveFilter(filter)}
          >
            {filter}
          </button>
        ))}
        <button type="button" className="od-filter-button">⌯</button>
      </div>

      <div className="od-market-headings">
        <span>Token / Creator</span>
        <span>Price</span>
        <span>24H Change</span>
        <span>Market Cap</span>
      </div>

      <div className="od-token-list">
        {marketplaceCards.map((token) => {
          const creator = getCreatorById(token.creatorId);

          return (
            <Link key={token.id} to={`/marketplace/token/${token.id}`} className="od-token-row">
              <div className="od-token-row__creator">
                <span className="od-token-row__avatar" style={{ background: creator?.accent ?? "#221930" }}>
                  {token.token[0]}
                </span>
                <div>
                  <strong>
                    {token.token} <span className="od-token-chip">${token.token}</span>
                  </strong>
                  <span>{token.creator}</span>
                  <small>{token.holders}</small>
                </div>
              </div>
              <div className="od-token-row__metric">
                <strong>{token.floor}</strong>
                <span>{token.usdFloor}</span>
              </div>
              <div className={`od-token-row__metric ${token.change.startsWith("-") ? "is-negative" : "is-positive"}`}>
                <strong>{token.change}</strong>
                <svg viewBox="0 0 120 28" className="od-mini-chart" aria-hidden="true">
                  <polyline
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    points={token.trend.map((value, index) => `${index * 6},${28 - value * 1.5}`).join(" ")}
                  />
                </svg>
              </div>
              <div className="od-token-row__metric">
                <strong>{token.marketCap}</strong>
                <span>{token.marketCapUsd}</span>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="od-page-spacer" />
    </section>
  );
}
