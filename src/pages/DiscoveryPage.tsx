import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { featureCards } from "../data/mockData";
import { useCollections } from "../hooks/useCollections";
import { useDemoWallet } from "../hooks/useDemoWallet";

const discoveryTabs = [
  { label: "For You", to: "/discover" },
  { label: "Trending", to: "/marketplace" },
  { label: "New", to: "/" },
  { label: "Following", to: "/creators" },
];

export function DiscoveryPage() {
  const navigate = useNavigate();
  const { isConnected, connect } = useDemoWallet();
  const { collect, isCollected } = useCollections();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isCollecting, setIsCollecting] = useState(false);

  const activeProduct = featureCards[activeIndex];
  const topShelf = featureCards.slice(5);

  const handleCollect = async () => {
    if (isCollected(activeProduct.id) || isCollecting) return;

    if (!isConnected) {
      connect();
    }

    setIsCollecting(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    collect(activeProduct.id);
    setIsCollecting(false);
  };

  return (
    <section className="od-page od-discovery-page">
      <header className="od-topbar">
        <Link to="/" className="od-brand">
          <span className="od-brand__mark" />
          <span>ONCHAIN DISCOVERY</span>
        </Link>
        <div className="od-topbar__actions">
          <button type="button" className="od-wallet-button" onClick={() => navigate("/library")}>
            Wallet
          </button>
          <button type="button" className="od-icon-button" aria-label="Notifications">
            <span className="od-dot" />
          </button>
        </div>
      </header>

      <div className="od-tabs">
        {discoveryTabs.map((tab) => (
          <button
            key={tab.label}
            type="button"
            className={`od-tabs__item ${tab.to === "/discover" ? "od-tabs__item--active" : ""}`}
            onClick={() => navigate(tab.to)}
          >
            {tab.label}
          </button>
        ))}
        <button type="button" className="od-search-fab" onClick={() => navigate("/marketplace")}>
          <span className="bottom-nav__icon bottom-nav__icon--search" />
        </button>
      </div>

      <article className="od-hero-card" style={{ background: activeProduct.accent }}>
        <div className="od-hero-card__badge-row">
          <span className="od-live-pill">Live now</span>
          <span className="od-hero-card__counter">
            {activeIndex + 1} / {featureCards.slice(0, 4).length}
          </span>
        </div>

        <button type="button" className="od-hero-card__menu" onClick={() => setActiveIndex((value) => (value + 1) % 4)}>
          •••
        </button>

        <div className="od-hero-card__identity">
          <Link to={`/creator/${activeProduct.creatorId}`} className="od-feed-card__identity">
            <span className="od-avatar" style={{ background: "rgba(255,255,255,0.12)" }}>
              N
            </span>
            <span>
              <strong>{activeProduct.creator}</strong>
              <span>{activeProduct.handle}</span>
              <small>{activeProduct.collectedCount} collectors</small>
            </span>
          </Link>
        </div>

        <div className="od-hero-card__cover">
          <div className="od-hero-card__copy">
            <h1>{activeProduct.title}</h1>
            <p>{activeProduct.summary}</p>
          </div>
          <div className="od-book-cover">
            <span>{activeProduct.type}</span>
            <strong>{activeProduct.title}</strong>
          </div>
        </div>

        <div className="od-tag-row">
          <span className="od-tag-pill">{activeProduct.type}</span>
          <span className="od-tag-pill">Onchain</span>
          <span className="od-tag-pill">Monetization</span>
          <span className="od-tag-pill">+1</span>
        </div>

        <div className="od-metric-row">
          <div>
            <strong>4.8</strong>
            <span>(120 reviews)</span>
          </div>
          <div>
            <strong>{activeProduct.collectedCount}</strong>
            <span>collected</span>
          </div>
          <div>
            <strong>120</strong>
            <span>sold today</span>
          </div>
        </div>

        <div className="od-cta-row">
          <button type="button" className="od-secondary-card-button" onClick={() => navigate(`/product/${activeProduct.id}`)}>
            <span>Preview</span>
            <small>View sample pages</small>
          </button>
          <button type="button" className="od-primary-card-button" onClick={() => void handleCollect()}>
            <span>{isCollecting ? "Collecting..." : `Buy for ${activeProduct.price}`}</span>
            <small>{activeProduct.usdPrice} Instant access</small>
          </button>
        </div>

        <div className="od-social-row">
          <button type="button" className="od-engagement-button">♡ 324</button>
          <button type="button" className="od-engagement-button">◌ 48</button>
          <button type="button" className="od-engagement-button">↗ 21</button>
          <button type="button" className="od-engagement-button od-engagement-button--save">⌑</button>
        </div>
      </article>

      <section className="od-section">
        <div className="od-section__header">
          <h2>Top selling this week</h2>
          <button type="button" className="od-text-link" onClick={() => navigate("/marketplace")}>
            View all
          </button>
        </div>
        <div className="od-shelf">
          {topShelf.map((product) => (
            <Link key={product.id} to={`/product/${product.id}`} className="od-shelf-card" style={{ background: product.accent }}>
              <div className="od-shelf-card__content">
                <strong>{product.title}</strong>
                <span>by {product.creator}</span>
                <em>{product.price}</em>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <div className="od-page-spacer" />
    </section>
  );
}
