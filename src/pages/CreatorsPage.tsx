import { Link } from "react-router-dom";
import { creators, getProductsByCreator } from "../data/mockData";

export function CreatorsPage() {
  return (
    <section className="screen">
      <div className="section-title">
        <div>
          <p className="eyebrow">Creators</p>
          <h2>People behind the products</h2>
        </div>
      </div>
      <div className="creators-list">
        {creators.map((creator) => (
          <Link key={creator.id} to={`/creator/${creator.id}`} className="creator-list-card">
            <span className="creator-list-card__art" style={{ background: creator.accent }} />
            <div>
              <h3>{creator.name}</h3>
              <p>{creator.handle}</p>
              <p>{creator.bio}</p>
              <span>{getProductsByCreator(creator.id).length} products live</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
