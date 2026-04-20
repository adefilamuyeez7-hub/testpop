import { useState } from "react";
import { Link } from "react-router-dom";
import type { ProductCard as ProductCardType } from "../data/mockData";
import { useCollections } from "../hooks/useCollections";
import { useDemoWallet } from "../hooks/useDemoWallet";

type Props = {
  product: ProductCardType;
  compact?: boolean;
};

export function ProductCard({ product, compact = false }: Props) {
  const [liked, setLiked] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isCollecting, setIsCollecting] = useState(false);
  const { isConnected, connect } = useDemoWallet();
  const { collect, isCollected } = useCollections();
  const collected = isCollected(product.id);

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

  const handleCollect = async () => {
    if (collected || isCollecting) {
      return;
    }

    if (!isConnected) {
      connect();
    }

    setIsCollecting(true);
    await new Promise((resolve) => setTimeout(resolve, 900));
    collect(product.id);
    setIsCollecting(false);
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
        <button
          type="button"
          className="product-card__menu"
          aria-label="Toggle preview"
          onClick={() => setShowPreview((value) => !value)}
        >
          {showPreview ? "Close" : "Preview"}
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
        {showPreview && (
          <div className="inline-preview-card">
            <strong>{product.previewLabel}</strong>
            <p>
              {product.type === "PDF" && "Preview the opening pages before you collect."}
              {product.type === "Image" && "Open a full-screen sample before you collect."}
              {product.type === "Tool" && "Review the toolkit summary and included files first."}
            </p>
          </div>
        )}
        <div className="product-card__footer">
          <div className="product-card__stats">
            <strong>{product.price}</strong>
            <span>{product.likes + (liked ? 1 : 0)} likes</span>
            <span>{product.gifts} shares</span>
          </div>
          <div className="product-card__actions">
            <button type="button" className="ghost-pill" onClick={() => setLiked((value) => !value)}>
              {liked ? "Liked" : "Like"}
            </button>
            <button type="button" className="ghost-pill" onClick={() => void handleShare()}>
              Share
            </button>
            <button type="button" className="solid-pill" onClick={() => void handleCollect()} disabled={collected || isCollecting}>
              {isCollecting ? "Collecting..." : collected ? "Collected" : `Collect ${product.price}`}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
