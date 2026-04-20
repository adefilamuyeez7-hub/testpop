import { Link } from "react-router-dom";

export function WelcomePage() {
  const slides = [
    {
      id: "slide1",
      icon: "Art",
      title: "Find, Collect and Sell",
      subtitle: "Amazing NFTs",
      description: "Explore the top collection of NFTs and buy and sell your NFTs as well",
      color: "linear-gradient(135deg, #FF69B4 0%, #FF1493 100%)",
    },
    {
      id: "slide2",
      icon: "Drops",
      title: "Discover Creators",
      subtitle: "Support Your Favorites",
      description: "Connect with talented creators and collect their exclusive digital works",
      color: "linear-gradient(135deg, #00CED1 0%, #20B2AA 100%)",
    },
    {
      id: "slide3",
      icon: "Tokens",
      title: "Token Liquidity",
      subtitle: "Creator Economy",
      description: "Hold creator tokens and access exclusive content and community benefits",
      color: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
    },
  ];

  return (
    <section className="screen screen--welcome">
      <div className="welcome-container">
        <div className="welcome-slider">
          {slides.map((slide) => (
            <div key={slide.id} className="welcome-slide" style={{ background: slide.color }}>
              <div className="welcome-slide__content">
                <div className="welcome-slide__icon">{slide.icon}</div>
                <h2 className="welcome-slide__title">{slide.title}</h2>
                <p className="welcome-slide__subtitle">{slide.subtitle}</p>
                <div className="welcome-slide__description">
                  <p>{slide.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="welcome-dots">
          {slides.map((_, index) => (
            <button
              key={index}
              type="button"
              className={`welcome-dot ${index === 0 ? "welcome-dot--active" : ""}`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>

        <div className="welcome-actions">
          <Link to="/" className="welcome-button welcome-button--primary">
            Get Started
            <span className="welcome-button__arrow">{">"}</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
