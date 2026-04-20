import { useState } from "react";
import { Link } from "react-router-dom";
import { featureCards } from "../data/mockData";

export function HomePage() {
  const [activeIndex, setActiveIndex] = useState(0);
  const featured = featureCards[activeIndex];

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % featureCards.length);
  };

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + featureCards.length) % featureCards.length);
  };

  return (
    <section className="screen screen--home-new">
      <div className="home-slider-deck">
        <div className="slider-card" style={{ background: featured.accent }}>
          <div className="slider-card__header">
            <button 
              type="button" 
              className="slider-location"
            >
              📍 Featured Creator
            </button>
            <span className="slider-card__meta">#{activeIndex + 1}</span>
          </div>

          <div className="slider-card__content">
            <div className="slider-card__avatar">{featured.creator.charAt(0)}</div>
            <h2 className="slider-card__title">{featured.title}</h2>
            <p className="slider-card__creator">{featured.creator}</p>
            <p className="slider-card__handle">{featured.handle}</p>
            
            <div className="slider-card__description">
              <p>{featured.summary}</p>
            </div>

            <div className="slider-card__tags">
              <span className="slider-tag">{featured.type}</span>
              <span className="slider-tag">{featured.price}</span>
            </div>
          </div>

          <div className="slider-card__actions">
            <Link to={`/product/${featured.id}`} className="slider-action-btn slider-action-btn--secondary">
              {featured.previewLabel}
            </Link>
            <Link to={`/product/${featured.id}`} className="slider-action-btn slider-action-btn--primary">
              Collect
            </Link>
          </div>

          <div className="slider-controls">
            <button 
              type="button" 
              className="slider-control-btn"
              onClick={handlePrev}
              aria-label="Previous"
            >
              ←
            </button>
            
            <div className="slider-dots">
              {featureCards.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  className={`slider-dot ${index === activeIndex ? "slider-dot--active" : ""}`}
                  onClick={() => setActiveIndex(index)}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>

            <button 
              type="button" 
              className="slider-control-btn"
              onClick={handleNext}
              aria-label="Next"
            >
              →
            </button>
          </div>
        </div>
      </div>

      <div className="home-collections-section">
        <div className="section-header">
          <h3>Featured Collections</h3>
          <Link to="/marketplace" className="see-all-link">See all</Link>
        </div>

        <div className="featured-collection-grid">
          {featureCards.map((product) => (
            <Link
              key={product.id}
              to={`/product/${product.id}`}
              className="featured-collection-item"
              style={{ background: product.accent }}
            >
              <div className="collection-item-content">
                <span className="collection-badge">{product.type}</span>
                <h4>{product.title}</h4>
                <p className="collection-creator">{product.creator}</p>
                <p className="collection-price">{product.price}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
