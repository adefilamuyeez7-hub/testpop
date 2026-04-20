import { useState } from "react";
import { Link } from "react-router-dom";
import { useParams } from "react-router-dom";
import { featureCards } from "../data/mockData";
import { useDemoWallet } from "../hooks/useDemoWallet";

export function ProductDetailPage() {
  const { productId } = useParams();
  const product = featureCards.find((item) => item.id === productId) ?? featureCards[0];
  const { isConnected, connect } = useDemoWallet();
  const [selectedType, setSelectedType] = useState(0);

  const lessonTypes = [
    { label: "Group lesson", price: "1700 руб", original: "2800 руб", discount: "40%" },
    { label: "Individual lesson", price: "2500 руб" },
  ];

  return (
    <section className="screen screen--product-detail">
      <div className="product-detail-media" style={{ background: product.accent }}>
        <span className="product-badge">{product.type}</span>
      </div>

      <div className="product-detail-content">
        <div className="product-detail-creator">
          <span className="product-detail-creator__label">Master class</span>
          <p className="product-detail-creator__name">{product.creator}</p>
        </div>

        <h1 className="product-detail-title">{product.title}</h1>

        <div className="service-options">
          {lessonTypes.map((type, index) => (
            <label key={index} className="service-option">
              <input 
                type="radio" 
                name="serviceType" 
                checked={selectedType === index}
                onChange={() => setSelectedType(index)}
              />
              <div className="service-option__content">
                {type.discount && (
                  <span className="service-discount">{type.discount}</span>
                )}
                <span className="service-label">{type.label}</span>
                <div className="service-prices">
                  <span className="service-price">{type.price}</span>
                  {type.original && (
                    <span className="service-original">{type.original}</span>
                  )}
                </div>
              </div>
            </label>
          ))}
        </div>

        <button
          type="button"
          className="cta-button cta-button--primary"
          onClick={isConnected ? undefined : connect}
        >
          {isConnected 
            ? `Pay ${lessonTypes[selectedType].price}` 
            : "Connect to book"}
        </button>

        <p className="product-detail-note">
          For continued training, must include a mandatory 50% deposit
        </p>

        <div className="product-detail-description">
          <h3>About this service</h3>
          <p>{product.summary}</p>
          <ul className="detail-points">
            <li>Expert instructor from POPUP platform</li>
            <li>Personalized learning experience</li>
            <li>Session recording available after booking</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
