import { useRef, useState } from "react";
import { featureCards } from "../data/mockData";
import { useCollections } from "../hooks/useCollections";
import { useDemoWallet } from "../hooks/useDemoWallet";

export function HomePage() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [isCollecting, setIsCollecting] = useState(false);
  const gestureStart = useRef<{ x: number; y: number } | null>(null);
  const { isConnected, connect } = useDemoWallet();
  const { collect, isCollected } = useCollections();

  const activeProduct = featureCards[activeIndex];

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % featureCards.length);
    setShowPreview(false);
  };

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + featureCards.length) % featureCards.length);
    setShowPreview(false);
  };

  const handleCollect = async () => {
    if (isCollected(activeProduct.id) || isCollecting) {
      return;
    }

    if (!isConnected) {
      connect();
    }

    setIsCollecting(true);
    await new Promise((resolve) => setTimeout(resolve, 900));
    collect(activeProduct.id);
    setIsCollecting(false);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    gestureStart.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!gestureStart.current) {
      return;
    }

    const deltaX = event.clientX - gestureStart.current.x;
    const deltaY = event.clientY - gestureStart.current.y;
    gestureStart.current = null;

    if (Math.abs(deltaX) < 50 || Math.abs(deltaX) < Math.abs(deltaY)) {
      return;
    }

    if (deltaX < 0) {
      handleNext();
      return;
    }

    handlePrev();
  };

  return (
    <section className="screen screen--home-stack">
      <div className="home-stack-container">
        <div className="card-stack">
          {featureCards.map((product, index) => {
            const position = (index - activeIndex + featureCards.length) % featureCards.length;
            const isActive = position === 0;
            const isVisible = position < 3;

            return isVisible ? (
              <div
                key={product.id}
                className={`card-stack__item ${isActive ? "card-stack__item--active" : ""}`}
                style={{
                  background: product.accent,
                  zIndex: featureCards.length - position,
                  transform: `translateY(${position * 14}px) scale(${1 - position * 0.035})`,
                }}
                onPointerDown={isActive ? handlePointerDown : undefined}
                onPointerUp={isActive ? handlePointerUp : undefined}
              >
                <div className="card-stack-header">
                  <div className="card-stack-location">Live from {product.creator}</div>
                  <span className="card-stack-position">
                    {activeIndex + 1}/{featureCards.length}
                  </span>
                </div>

                <div className="card-stack-content">
                  <div className="card-stack-avatar">{product.creator.charAt(0)}</div>
                  <h2 className="card-stack-title">{product.title}</h2>
                  <p className="card-stack-creator">{product.creator}</p>
                  <p className="card-stack-handle">{product.handle}</p>

                  <div className="card-stack-description">
                    <p>{product.summary}</p>
                  </div>

                  <div className="card-stack-tags">
                    <span className="card-stack-tag">{product.type}</span>
                    <span className="card-stack-tag">{product.price}</span>
                  </div>

                  {isActive && showPreview && (
                    <div className="card-stack-preview">
                      <strong>{product.previewLabel}</strong>
                      <p>{product.summary}</p>
                    </div>
                  )}
                </div>

                <div className="card-stack-actions">
                  <button
                    type="button"
                    className="card-action-btn card-action-btn--secondary"
                    onClick={() => setShowPreview((value) => !value)}
                    disabled={!isActive}
                  >
                    {showPreview && isActive ? "Hide preview" : product.previewLabel}
                  </button>
                  <button
                    type="button"
                    className="card-action-btn card-action-btn--primary"
                    onClick={() => void handleCollect()}
                    disabled={!isActive || isCollecting || isCollected(product.id)}
                  >
                    {isCollecting && isActive
                      ? "Collecting..."
                      : isCollected(product.id)
                        ? "Collected"
                        : `Collect ${product.price}`}
                  </button>
                </div>

                <div className="card-stack-hint">
                  {isActive && (
                    <button type="button" className="card-stack-next" onClick={handleNext}>
                      Swipe or tap next
                    </button>
                  )}
                </div>
              </div>
            ) : null;
          })}
        </div>
      </div>
    </section>
  );
}
