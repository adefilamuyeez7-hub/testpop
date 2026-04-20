import { useState } from "react";
import { Link } from "react-router-dom";
import { creators, featureCards } from "../data/mockData";
import { useCollections } from "../hooks/useCollections";
import { useDemoWallet } from "../hooks/useDemoWallet";

export function DiscoveryPage() {
  const { isConnected, connect } = useDemoWallet();
  const { collect, isCollected } = useCollections();
  const [collectingId, setCollectingId] = useState<string | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  const handleCollect = async (productId: string) => {
    if (isCollected(productId) || collectingId) return;
    if (!isConnected) {
      connect();
      return;
    }

    setCollectingId(productId);
    await new Promise((resolve) => setTimeout(resolve, 900));
    collect(productId);
    setCollectingId(null);
  };

  const toggleLike = (productId: string) => {
    const newLiked = new Set(likedIds);
    if (newLiked.has(productId)) {
      newLiked.delete(productId);
    } else {
      newLiked.add(productId);
    }
    setLikedIds(newLiked);
  };

  return (
    <section className="screen screen--discovery-feed">
      <div className="discovery-header">
        <h2>Discover</h2>
        <Link to="/creators" className="filter-button">
          Creators
        </Link>
      </div>

      <div className="stories-strip">
        <div className="stories-scroll">
          {creators.map((creator) => (
            <Link key={creator.id} to={`/creator/${creator.id}`} className="story-bubble">
              <span className="story-bubble__ring">
                <span className="story-bubble__avatar" style={{ background: creator.accent }} />
              </span>
              <span className="story-bubble__name">{creator.name.split(" ")[0]}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="insta-grid-container">
        {featureCards.map((product) => (
          <Link
            key={product.id}
            to={`/product/${product.id}`}
            className="insta-grid-item"
            style={{ background: product.accent }}
          >
            <div className="insta-grid-item__overlay">
              <div className="insta-grid-item__header">
                <Link
                  to={`/creator/${product.creatorId}`}
                  className="insta-grid-item__creator"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span
                    className="insta-grid-item__avatar"
                    style={{ background: product.accent }}
                  />
                  <div>
                    <div className="insta-grid-item__creator-name">{product.creator}</div>
                    <div className="insta-grid-item__creator-handle">{product.handle}</div>
                  </div>
                </Link>
              </div>

              <div className="insta-grid-item__content">
                <h3 className="insta-grid-item__title">{product.title}</h3>
                <p className="insta-grid-item__summary">{product.summary}</p>

                <div className="insta-grid-item__meta">
                  <span className="product-badge">{product.type}</span>
                  <span className="insta-grid-item__price">{product.price}</span>
                </div>
              </div>

              <div className="insta-grid-item__actions">
                <button
                  type="button"
                  className="insta-action-btn"
                  onClick={(e) => {
                    e.preventDefault();
                    toggleLike(product.id);
                  }}
                  title="Like"
                >
                  <span className="insta-action-icon">♥</span>
                  <span className="insta-action-count">
                    {product.likes + (likedIds.has(product.id) ? 1 : 0)}
                  </span>
                </button>

                <button
                  type="button"
                  className="insta-action-btn"
                  onClick={(e) => {
                    e.preventDefault();
                  }}
                  title="Share"
                >
                  <span className="insta-action-icon">↗</span>
                  <span className="insta-action-count">{product.gifts}</span>
                </button>

                <button
                  type="button"
                  className={`insta-action-btn insta-action-btn--collect ${
                    isCollected(product.id) ? "insta-action-btn--collected" : ""
                  }`}
                  onClick={(e) => {
                    e.preventDefault();
                    void handleCollect(product.id);
                  }}
                  disabled={isCollected(product.id) || collectingId === product.id}
                  title={isCollected(product.id) ? "Collected" : "Collect"}
                >
                  <span className="insta-action-icon">
                    {collectingId === product.id ? "..." : isCollected(product.id) ? "✓" : "+"}
                  </span>
                  <span className="insta-action-label">
                    {collectingId === product.id
                      ? "Collecting"
                      : isCollected(product.id)
                        ? "Collected"
                        : "Collect"}
                  </span>
                </button>
              </div>
            </div>

            <span className="insta-grid-item__badge">{product.previewLabel}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
