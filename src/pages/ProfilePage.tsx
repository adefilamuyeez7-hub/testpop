export function ProfilePage() {
  return (
    <section className="screen">
      <div className="profile-hero">
        <p className="eyebrow">Collector first</p>
        <h2>Your POPUP profile</h2>
        <p>
          Browse without registration, then connect your wallet when you want to collect, track
          purchases, or manage creator products.
        </p>
      </div>

      <div className="profile-grid">
        <article className="profile-panel">
          <h3>Collected</h3>
          <p>Owned PDFs, images, and tools appear here after collect.</p>
        </article>
        <article className="profile-panel">
          <h3>Creator studio</h3>
          <p>Publish products, launch creator tokens, and monitor earnings.</p>
        </article>
        <article className="profile-panel">
          <h3>Marketplace activity</h3>
          <p>Track creator token buys, sells, and listing performance.</p>
        </article>
      </div>
    </section>
  );
}
