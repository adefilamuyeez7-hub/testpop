import { ProductCard } from "../components/ProductCard";
import { featureCards } from "../data/mockData";

export function DiscoveryPage() {
  return (
    <section className="screen">
      <div className="section-title">
        <div>
          <p className="eyebrow">Discovery feed</p>
          <h2>Digital products from creators</h2>
        </div>
        <button type="button">Filter</button>
      </div>
      <div className="feed-list">
        {featureCards.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
