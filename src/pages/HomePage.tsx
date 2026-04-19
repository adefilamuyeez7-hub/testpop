import { featureCards } from "../data/mockData";

export function HomePage() {
  const featured = featureCards[0];

  return (
    <section className="screen screen--home">
      <div className="story-card" style={{ background: featured.accent }}>
        <div className="story-card__top">
          <span className="story-chip">{featured.creator}</span>
          <span className="story-chip story-chip--muted">{featured.type}</span>
        </div>
        <div className="story-card__body">
          <p className="eyebrow">Swipe-style discovery</p>
          <h2>{featured.title}</h2>
          <p>{featured.summary}</p>
        </div>
        <div className="story-card__actions">
          <button type="button" className="ghost-pill ghost-pill--light">
            Preview
          </button>
          <button type="button" className="solid-pill solid-pill--dark">
            Collect {featured.price}
          </button>
        </div>
      </div>

      <div className="screen-section">
        <div className="section-title">
          <h3>Trending creators</h3>
          <button type="button">See all</button>
        </div>
        <div className="creator-row">
          {featureCards.map((item) => (
            <div className="creator-pill" key={item.id}>
              <span className="creator-pill__avatar" style={{ background: item.accent }} />
              <div>
                <strong>{item.creator}</strong>
                <p>{item.handle}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
