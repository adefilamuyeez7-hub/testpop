import { Link, useParams } from "react-router-dom";
import { ProductCard } from "../components/ProductCard";
import { getCreatorById, getProductsByCreator } from "../data/mockData";

export function CreatorProfilePage() {
  const { creatorId } = useParams();
  const creator = getCreatorById(creatorId ?? "") ?? getCreatorById("nora-vale");
  const products = creator ? getProductsByCreator(creator.id) : [];

  if (!creator) {
    return null;
  }

  const stats = {
    following: 252,
    followers: 24000,
    creations: 732,
  };

  return (
    <section className="screen screen--creator-profile">
      <div 
        className="creator-profile-hero"
        style={{ background: creator.accent }}
      >
        <div className="creator-profile-hero__header">
          <button type="button" className="close-button">×</button>
          <button type="button" className="menu-button">⋯</button>
        </div>
        
        <div className="creator-profile-hero__avatar" style={{ background: creator.accent }}>
          {creator.name.charAt(0)}
        </div>
      </div>

      <div className="creator-profile-info">
        <h1 className="creator-profile-name">{creator.name}</h1>
        <p className="creator-profile-handle">{creator.handle}</p>
        
        <button type="button" className="follow-button">
          Follow
        </button>

        <div className="creator-profile-stats">
          <div className="stat-item">
            <span className="stat-number">{stats.following}</span>
            <span className="stat-label">Following</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{stats.followers}K</span>
            <span className="stat-label">Followers</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{stats.creations}</span>
            <span className="stat-label">Creations</span>
          </div>
        </div>

        <p className="creator-profile-bio">{creator.bio}</p>

        <div className="creator-profile-actions">
          <Link to={`/marketplace/token/${creator.tokenId}`} className="ghost-pill ghost-pill--full">
            {creator.name}◆ token market
          </Link>
        </div>
      </div>

      <div className="creator-content-section">
        <h2>Latest Works</h2>
        <div className="feed-list">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} compact />
          ))}
        </div>
      </div>
    </section>
  );
}
