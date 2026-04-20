import { Link } from "react-router-dom";
import { marketplaceCards } from "../data/mockData";

export function MarketplacePage() {
  return (
    <section className="screen">
      <div className="section-title">
        <div>
          <p className="eyebrow">Peer-to-peer</p>
          <h2>Creator token marketplace</h2>
        </div>
        <Link to="/profile" className="section-link">
          List token
        </Link>
      </div>
      <div className="market-list">
        {marketplaceCards.map((item) => (
          <Link className="market-card market-card--token" key={item.id} to={`/marketplace/token/${item.id}`}>
            <div className="market-card__cover" />
            <div className="market-card__main">
              <p>{item.creator}</p>
              <h3>{item.token}</h3>
              <p>{item.holders}</p>
            </div>
            <div className="market-card__price">
              <span>Current market price</span>
              <strong>{item.floor}</strong>
            </div>
            <div className="market-card__footer">
              <span>{item.change}</span>
              <span>Instant liquidity {item.liquidity}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
