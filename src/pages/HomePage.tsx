import { Link, useNavigate } from "react-router-dom";
import { creators, feedPosts, feedStories, getCreatorById, getProductById, getTokenById } from "../data/mockData";

const feedTabs = [
  { label: "For You", to: "/" },
  { label: "Following", to: "/creators" },
  { label: "Trending", to: "/marketplace" },
  { label: "New", to: "/discover" },
];

export function HomePage() {
  const navigate = useNavigate();

  return (
    <section className="od-page od-feed-page">
      <header className="od-topbar">
        <Link to="/" className="od-brand">
          <span className="od-brand__mark" />
          <span>ONCHAIN DISCOVERY</span>
        </Link>
        <div className="od-topbar__actions">
          <button type="button" className="od-icon-button" aria-label="Search" onClick={() => navigate("/discover")}>
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

      <div className="od-tabs">
        {feedTabs.map((tab) => (
          <button
            key={tab.label}
            type="button"
            className={`od-tabs__item ${tab.to === "/" ? "od-tabs__item--active" : ""}`}
            onClick={() => navigate(tab.to)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="od-story-row">
        {feedStories.map((story) => {
          const creator = story.creatorId ? getCreatorById(story.creatorId) : null;

          return (
            <button
              key={story.id}
              type="button"
              className="od-story"
              onClick={() => navigate(story.creatorId ? `/creator/${story.creatorId}` : "/discover")}
            >
              <span className="od-story__ring" style={{ background: story.accent }}>
                <span className="od-story__avatar">
                  {creator ? creator.name.split(" ").map((part) => part[0]).join("").slice(0, 2) : "✦"}
                </span>
                {story.online && <span className="od-story__status" />}
              </span>
              <span className="od-story__label">{story.label}</span>
            </button>
          );
        })}
      </div>

      <div className="od-feed-list">
        {feedPosts.map((post) => {
          const creator = getCreatorById(post.creatorId);
          const token = post.previewType === "token" ? getTokenById(post.previewId) : null;
          const product = post.previewType === "product" ? getProductById(post.previewId) : null;

          if (!creator) {
            return null;
          }

          return (
            <article key={post.id} className="od-feed-card">
              <div className="od-feed-card__header">
                <Link to={`/creator/${creator.id}`} className="od-feed-card__identity">
                  <span className="od-avatar" style={{ background: creator.accent }}>
                    {creator.name.charAt(0)}
                  </span>
                  <span>
                    <strong>{creator.name}</strong>
                    <span>{creator.handle}</span>
                  </span>
                </Link>
                <span className="od-feed-card__time">{post.timeAgo}</span>
              </div>

              <div className="od-feed-card__copy">
                {post.body.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>

              {token && (
                <div className="od-token-preview">
                  <div className="od-token-preview__hero">
                    <div>
                      <div className="od-token-preview__symbol">${token.token}</div>
                      <p>Join the movement.</p>
                    </div>
                    <button type="button" className="od-pill-button" onClick={() => navigate(`/marketplace/token/${token.id}`)}>
                      {post.primaryCta}
                    </button>
                  </div>
                  <div className="od-token-preview__meta">
                    <h3>
                      {token.token} <span>by {creator.name}</span>
                    </h3>
                    <span className="od-token-chip">Creator Token</span>
                    <div className="od-token-preview__stats">
                      <div>
                        <span>Price</span>
                        <strong>{token.floor}</strong>
                        <small>{token.change} (24h)</small>
                      </div>
                      <div>
                        <span>Holders</span>
                        <strong>{token.holdersCount}</strong>
                      </div>
                      <div>
                        <span>Market Cap</span>
                        <strong>{token.marketCap}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {product && (
                <div className="od-product-preview">
                  <div className="od-product-preview__cover" style={{ background: product.accent }}>
                    <span>{product.meta}</span>
                    <strong>{product.title}</strong>
                  </div>
                  <div className="od-product-preview__body">
                    <h3>{product.title}</h3>
                    <p>by {creator.name}</p>
                    <span className="od-token-chip">{product.type}</span>
                    <p>{product.summary}</p>
                    <div className="od-product-preview__stats">
                      <div>
                        <strong>{product.price}</strong>
                        <span>Price</span>
                      </div>
                      <div>
                        <strong>{getTokenById(creator.tokenId)?.marketCap ?? "24.6 ETH"}</strong>
                        <span>Volume</span>
                      </div>
                      <button type="button" className="od-preview-action" onClick={() => navigate(`/product/${product.id}`)}>
                        {post.primaryCta}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="od-feed-card__footer">
                <button type="button" className="od-engagement-button">
                  <span className="od-engagement-icon">♡</span>
                  {post.likes}
                </button>
                <button type="button" className="od-engagement-button">
                  <span className="od-engagement-icon">◌</span>
                  {post.comments}
                </button>
                <button type="button" className="od-engagement-button">
                  <span className="od-engagement-icon">↻</span>
                  {post.reposts}
                </button>
                <button type="button" className="od-engagement-button od-engagement-button--save">
                  ⌑
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <div className="od-page-spacer" />
    </section>
  );
}
