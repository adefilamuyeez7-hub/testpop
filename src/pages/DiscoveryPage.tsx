import { Link } from "react-router-dom";
import { creators, featureCards } from "../data/mockData";

export function DiscoveryPage() {
  return (
    <section className="screen screen--discovery-feed">
      <div className="discovery-header">
        <h2>Discover</h2>
        <button type="button" className="filter-button">
          ⚙
        </button>
      </div>

      <div className="profile-feed">
        {creators.map((creator, index) => {
          const creatorProducts = featureCards.filter(p => p.creatorId === creator.id);
          
          return (
            <article 
              key={creator.id}
              className="feed-profile-card"
              style={{ background: creator.accent }}
            >
              <div className="feed-profile-card__header">
                <button type="button" className="feed-close-button">✕</button>
                <button type="button" className="feed-menu-button">⋯</button>
              </div>

              <div className="feed-profile-card__avatar">
                {creator.name.charAt(0)}
              </div>

              <div className="feed-profile-card__info">
                <h3>{creator.name}</h3>
                <p className="feed-profile-handle">{creator.handle}</p>
              </div>

              <div className="feed-profile-card__bio">
                <p>{creator.bio}</p>
              </div>

              <div className="feed-profile-card__actions">
                <Link to={`/creator/${creator.id}`} className="feed-action-link">
                  View Profile →
                </Link>
              </div>

              <div className="feed-profile-card__gallery">
                {creatorProducts.slice(0, 3).map(product => (
                  <div
                    key={product.id}
                    className="gallery-item"
                    style={{ background: product.accent }}
                  />
                ))}
              </div>
            </article>
          );
        })}
      </div>

      <div className="stories-strip">
        <h3>Featured</h3>
        <div className="stories-scroll">
          {creators.map((creator) => (
            <Link key={creator.id} to={`/creator/${creator.id}`} className="story-bubble">
              <span className="story-bubble__ring">
                <span className="story-bubble__avatar" style={{ background: creator.accent }} />
              </span>
              <span>{creator.name.split(" ")[0]}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="section-title">
        <div>
          <p className="eyebrow">Digital content</p>
          <h2>Recent Collections</h2>
        </div>
      </div>

      <div className="recent-products">
        {featureCards.map((product) => (
          <Link 
            key={product.id} 
            to={`/product/${product.id}`}
            className="recent-product-item"
          >
            <div className="recent-product-media" style={{ background: product.accent }}>
              <span className="product-badge">{product.type}</span>
            </div>
            <div className="recent-product-info">
              <h4>{product.title}</h4>
              <p>{product.creator}</p>
              <span className="recent-product-price">{product.price}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
