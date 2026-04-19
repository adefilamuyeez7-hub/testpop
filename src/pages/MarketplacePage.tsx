import { marketplaceCards } from "../data/mockData";

export function MarketplacePage() {
  return (
    <section className="screen">
      <div className="section-title">
        <div>
          <p className="eyebrow">Peer-to-peer</p>
          <h2>Creator token marketplace</h2>
        </div>
        <button type="button">List token</button>
      </div>
      <div className="market-list">
        {marketplaceCards.map((item) => (
          <article className="market-card" key={item.id}>
            <div>
              <p>{item.creator}</p>
              <h3>{item.token}</h3>
            </div>
            <div className="market-card__meta">
              <strong>{item.floor}</strong>
              <span>{item.change}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
