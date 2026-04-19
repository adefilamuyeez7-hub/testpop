import { ProductCard } from "../components/ProductCard";
import { featureCards } from "../data/mockData";

export function CreatorProfilePage() {
  return (
    <section className="screen">
      <div className="profile-hero">
        <p className="eyebrow">Creator profile</p>
        <h2>Nora Vale</h2>
        <p>
          Creator token launches, product drops, and digital files should all feel native to the
          discovery flow.
        </p>
      </div>
      <div className="feed-list">
        {featureCards.map((product) => (
          <ProductCard key={product.id} product={product} compact />
        ))}
      </div>
    </section>
  );
}
