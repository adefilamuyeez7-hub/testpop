import { useState } from "react";
import { Link } from "react-router-dom";
import type { ProductCard as ProductCardType } from "../data/mockData";

type Props = {
  product: ProductCardType;
  compact?: boolean;
};

export function ProductCard({ product, compact = false }: Props) {
  const [liked, setLiked] = useState(false);

  const handleShare = async () => {
    const url = `${window.location.origin}/product/${product.id}`;
    if (navigator.share) {
      await navigator.share({
        title: product.title,
        text: `${product.creator} on POPUP`,
        url,
      });
      return;
    }

    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
    }
  };

  return (
    <article className={compact ? "product-card product-card--compact" : "product-card"}>
      <div className="product-card__head">
        <Link to={`/creator/${product.creatorId}`} className="product-card__identity">
          <span className="product-card__avatar" style={{ background: product.accent }} />
          <span>
            {product.creator} <span>{product.handle}</span>
          </span>
        </Link>
        <button type="button" className="product-card__menu" aria-label="More actions">
          ...
        </button>
      </div>
      <Link to={`/product/${product.id}`} className="product-card__media" style={{ background: product.accent }}>
        <span className="product-badge">{product.type}</span>
        <span className="product-media__preview">{product.previewLabel}</span>
        <span className="product-media__glow" />
      </Link>
      <div className="product-card__content">
        <Link to={`/product/${product.id}`} className="product-card__title">
          <h3>{product.title}</h3>
        </Link>
        <p>{product.summary}</p>
        <div className="product-card__footer">
          <div className="product-card__stats">
            <strong>{product.price}</strong>
            <span>{product.likes + (liked ? 1 : 0)} likes</span>
            <span>{product.gifts} gifts</span>
          </div>
          <div className="product-card__actions">
            <button type="button" className="ghost-pill" onClick={() => setLiked((value) => !value)}>
              {liked ? "Liked" : "Like"}
            </button>
            <button type="button" className="ghost-pill" onClick={() => void handleShare()}>
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
