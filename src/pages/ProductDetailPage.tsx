import { useParams } from "react-router-dom";
import { featureCards } from "../data/mockData";

export function ProductDetailPage() {
  const { productId } = useParams();
  const product = featureCards.find((item) => item.id === productId) ?? featureCards[0];

  return (
    <section className="screen">
      <article className="detail-card">
        <div className="detail-card__media" style={{ background: product.accent }}>
          <span className="product-badge">{product.type}</span>
        </div>
        <div className="detail-card__content">
          <p className="product-card__creator">
            {product.creator} <span>{product.handle}</span>
          </p>
          <h2>{product.title}</h2>
          <p>{product.summary}</p>
          <ul className="detail-points">
            <li>Preview before collect</li>
            <li>Wallet requested only at action time</li>
            <li>
              {product.type === "Tool"
                ? "Download unlocks after collect"
                : product.type === "PDF"
                  ? "Read inside POPUP after collect"
                  : "View full image inside POPUP after collect"}
            </li>
          </ul>
          <button type="button" className="solid-pill solid-pill--large">
            Collect {product.price}
          </button>
        </div>
      </article>
    </section>
  );
}
