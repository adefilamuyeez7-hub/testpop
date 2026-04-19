import { Link } from "react-router-dom";
import type { ProductCard as ProductCardType } from "../data/mockData";

type Props = {
  product: ProductCardType;
  compact?: boolean;
};

export function ProductCard({ product, compact = false }: Props) {
  return (
    <article className={compact ? "product-card product-card--compact" : "product-card"}>
      <div className="product-card__media" style={{ background: product.accent }}>
        <span className="product-badge">{product.type}</span>
      </div>
      <div className="product-card__content">
        <p className="product-card__creator">
          {product.creator} <span>{product.handle}</span>
        </p>
        <h3>{product.title}</h3>
        <p>{product.summary}</p>
        <div className="product-card__footer">
          <strong>{product.price}</strong>
          <div className="product-card__actions">
            <button type="button" className="ghost-pill">
              Like
            </button>
            <button type="button" className="ghost-pill">
              Gift
            </button>
            <Link to={`/product/${product.id}`} className="solid-pill">
              Collect
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
