import { Link } from "react-router-dom";

export function DesktopLandingPage() {
  return (
    <div className="desktop-landing">
      <header className="desktop-landing__header">
        <span className="brand">POPUP</span>
        <div className="desktop-landing__actions">
          <a href="#why-popup">Why POPUP</a>
          <a href="#flow">Flow</a>
          <Link to="/discover" className="ghost-pill">
            Open app
          </Link>
        </div>
      </header>

      <section className="desktop-hero">
        <div className="desktop-hero__copy">
          <p className="eyebrow">Discover digital products onchain</p>
          <h1>
            Find products from creators
            <span> in a fast, visual flow.</span>
          </h1>
          <p className="desktop-hero__text">
            POPUP brings Instagram-like discovery to digital files, creator drops, and tokenized
            resale. Browse first. Preview first. Connect only when it is time to collect.
          </p>
          <div className="desktop-hero__cta">
            <Link to="/discover" className="solid-pill solid-pill--large">
              Enter POPUP
            </Link>
            <Link to="/profile" className="text-link">
              Explore profile flow
            </Link>
          </div>
        </div>

        <div className="desktop-hero__visual" aria-hidden="true">
          <div className="desktop-visual desktop-visual--main">
            <div className="desktop-visual__surface" />
          </div>
          <div className="desktop-visual desktop-visual--card">
            <div className="desktop-visual__accent" />
          </div>
          <div className="desktop-hero__pin">POP</div>
        </div>
      </section>

      <section className="desktop-section" id="why-popup">
        <h2>Bring creator products to life</h2>
        <p>
          PDFs render in-app, images feel native, and downloadable tools unlock cleanly after
          collect. Collectors do not need to register just to browse.
        </p>
      </section>

      <section className="desktop-grid" id="flow">
        <article>
          <h3>Home</h3>
          <p>Story-style discovery with one strong product card at a time.</p>
        </article>
        <article>
          <h3>Discovery</h3>
          <p>Feed-based browse experience with creators, likes, gifts, and collect.</p>
        </article>
        <article>
          <h3>Marketplace</h3>
          <p>Peer-to-peer creator token resale without cluttering the main feed.</p>
        </article>
      </section>
    </div>
  );
}
