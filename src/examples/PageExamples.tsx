/**
 * Page Implementation Examples with SEO
 * Location: src/examples/PageExamples.tsx
 * 
 * Demonstrates how to implement SEO in different page types
 */

import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { SEOHead } from '@/components/seo/SEOHead';
import {
  generateHomeSeo,
  generateBrowseSeo,
  generateArtistProfileSeo,
  generateProductSeo,
  generateDropSeo,
  generateArticleSeo,
  getBreadcrumbs
} from '@/utils/seo';
import {
  generateOrganizationSchema,
  generateArtistSchema,
  generateProductSchema,
  generateCollectionSchema,
  generateArticleSchema,
  generateFAQSchema
} from '@/utils/schema';

/**
 * ============================================
 * HOME PAGE EXAMPLE
 * ============================================
 */
export function HomePageExample() {
  const seoMeta = generateHomeSeo();
  const breadcrumbs = getBreadcrumbs('/');

  const faqSchema = generateFAQSchema([
    {
      question: 'What is POPUP?',
      answer: 'POPUP is a Web3 creator platform where digital artists can sell NFTs and subscriptions directly to collectors.'
    },
    {
      question: 'How do I buy NFT art on POPUP?',
      answer: 'Sign up with your Web3 wallet, browse artists and collections, and complete purchases with ETH.'
    },
    {
      question: 'How much does it cost to list on POPUP?',
      answer: 'As an artist, you can create your profile and list drops for free. We take a small platform fee on sales.'
    }
  ]);

  return (
    <>
      <SEOHead
        meta={seoMeta}
        schema={[generateOrganizationSchema(), faqSchema]}
        breadcrumbs={breadcrumbs}
      />

      <main>
        <section className="hero">
          <h1>{seoMeta.title}</h1>
          <p>{seoMeta.description}</p>
        </section>

        <section className="featured-artists">
          <h2>Featured Digital Artists This Week</h2>
          {/* Artist cards */}
        </section>

        <section className="trending-drops">
          <h2>Trending NFT Collections</h2>
          {/* Drop cards */}
        </section>

        <section className="faq">
          <h2>Frequently Asked Questions</h2>
          <div itemScope itemType="https://schema.org/FAQPage">
            <div itemProp="mainEntity" itemScope itemType="https://schema.org/Question">
              <h3 itemProp="name">What is POPUP?</h3>
              <div itemProp="acceptedAnswer" itemScope itemType="https://schema.org/Answer">
                <p itemProp="text">POPUP is a Web3 creator platform...</p>
              </div>
            </div>
          </div>
        </section>

        <section className="cta">
          <h2>Ready to Collect or Create?</h2>
          <a href="/browse">Browse Artists</a>
          <a href="/studio">Become a Creator</a>
        </section>
      </main>
    </>
  );
}

/**
 * ============================================
 * ARTIST PROFILE PAGE EXAMPLE
 * ============================================
 */
export function ArtistProfilePageExample() {
  const { artistId } = useParams<{ artistId: string }>();

  // Fetch artist data (example)
  const artist = {
    id: artistId || '1',
    name: 'Sarah NFT Sculptor',
    bio: 'Creating digital sculptures and 3D art on the blockchain. Web3 artist since 2023.',
    avatar_url: 'https://example.com/artist-avatar.jpg',
    location: 'San Francisco, CA',
    twitter_url: 'https://twitter.com/sarahnftsculptor',
    instagram_url: 'https://instagram.com/sarahnftsculptor',
    subscribers_count: 1234,
    drops_count: 8,
    updated_at: new Date().toISOString()
  };

  const drops = [
    {
      id: 'drop-1',
      title: '3D Digital Sculptures vol. 1',
      description: 'Limited edition 3D sculptures minted on Base Chain',
      image_url: 'https://example.com/drop1.jpg',
      created_at: '2026-01-15T00:00:00Z'
    }
  ];

  const seoMeta = generateArtistProfileSeo(artist);
  const breadcrumbs = getBreadcrumbs(`/artist/${artistId}`);
  const schemaMarkup = generateArtistSchema(artist);

  return (
    <>
      <SEOHead
        meta={seoMeta}
        schema={schemaMarkup}
        breadcrumbs={breadcrumbs}
      />

      <main>
        <article itemScope itemType="https://schema.org/Person">
          {/* Profile Header */}
          <section className="profile-header">
            <img
              itemProp="image"
              src={artist.avatar_url}
              alt={artist.name}
              width={200}
              height={200}
            />
            <h1 itemProp="name">{artist.name}</h1>
            <p itemProp="description">{artist.bio}</p>
            <p itemProp="jobTitle">Digital Artist</p>
            <p className="subscriber-count">{artist.subscribers_count} Subscribers</p>

            {/* Social Links */}
            <div className="social-links">
              {artist.twitter_url && (
                <a href={artist.twitter_url} rel="me">
                  Twitter
                </a>
              )}
              {artist.instagram_url && (
                <a href={artist.instagram_url} rel="me">
                  Instagram
                </a>
              )}
            </div>

            {/* Subscribe CTA */}
            <div className="subscription">
              <h2>Subscribe to {artist.name}</h2>
              <p>Get exclusive early access to new drops and supporter benefits</p>
              <button>Subscribe Now</button>
            </div>
          </section>

          {/* Drops Section */}
          <section className="drops">
            <h2>NFT Collections & Drops</h2>
            <div className="drop-grid">
              {drops.map(drop => (
                <article
                  key={drop.id}
                  className="drop-card"
                  itemScope
                  itemType="https://schema.org/CreativeWork"
                >
                  <img
                    itemProp="image"
                    src={drop.image_url}
                    alt={drop.title}
                    width={300}
                    height={300}
                  />
                  <h3 itemProp="name">{drop.title}</h3>
                  <p itemProp="description">{drop.description}</p>
                  <meta itemProp="creator" content={artist.name} />
                  <link itemProp="url" href={`/drop/${drop.id}`} />
                  <a href={`/drop/${drop.id}`}>View Collection</a>
                </article>
              ))}
            </div>
          </section>

          {/* Stats Section */}
          <section className="stats">
            <h2>Artist Statistics</h2>
            <div className="stat-grid">
              <div>
                <strong>{artist.subscribers_count}</strong>
                <p>Subscribers</p>
              </div>
              <div>
                <strong>{artist.drops_count}</strong>
                <p>Drops Created</p>
              </div>
              <div>
                <strong>1.2K+</strong>
                <p>Items Sold</p>
              </div>
            </div>
          </section>

          {/* Similar Artists */}
          <section className="similar-artists">
            <h2>You Might Also Like</h2>
            <p>Other digital artists with similar styles</p>
            {/* Similar artist cards */}
          </section>
        </article>
      </main>
    </>
  );
}

/**
 * ============================================
 * PRODUCT PAGE EXAMPLE
 * ============================================
 */
export function ProductPageExample() {
  const { productId } = useParams<{ productId: string }>();

  const product = {
    id: productId || '1',
    name: '3D Sculpture Digital File',
    description: 'High-resolution 3D sculpture file for 3D printing or virtual worlds',
    image_url: 'https://example.com/product.jpg',
    price_eth: 2.5,
    creator_name: 'Sarah NFT Sculptor',
    stock: 10,
    rating: 4.8,
    review_count: 42,
    updated_at: new Date().toISOString()
  };

  const seoMeta = generateProductSeo(product);
  const breadcrumbs = getBreadcrumbs(`/product/${productId}`);
  const schema = generateProductSchema(product);

  return (
    <>
      <SEOHead
        meta={seoMeta}
        schema={schema}
        breadcrumbs={breadcrumbs}
      />

      <main>
        <article itemScope itemType="https://schema.org/Product">
          <section className="product-header">
            <img
              itemProp="image"
              src={product.image_url}
              alt={product.name}
              width={500}
              height={500}
            />

            <div className="product-info">
              <h1 itemProp="name">{product.name}</h1>
              <p itemProp="description">{product.description}</p>

              {/* Creator Info */}
              <p>
                by{' '}
                <span itemProp="brand" itemScope itemType="https://schema.org/Brand">
                  <span itemProp="name">{product.creator_name}</span>
                </span>
              </p>

              {/* Rating */}
              {product.rating && (
                <div
                  itemProp="aggregateRating"
                  itemScope
                  itemType="https://schema.org/AggregateRating"
                >
                  <span itemProp="ratingValue">{product.rating}</span>/
                  <span itemProp="bestRating">5</span> ({' '}
                  <span itemProp="ratingCount">{product.review_count}</span> reviews)
                </div>
              )}

              {/* Price */}
              <div
                itemProp="offers"
                itemScope
                itemType="https://schema.org/Offer"
              >
                <span itemProp="priceCurrency" content="ETH" />
                <span itemProp="price">{product.price_eth}</span>
                <meta
                  itemProp="availability"
                  content={product.stock > 0 ? 'InStock' : 'OutOfStock'}
                />
                <button disabled={product.stock === 0}>
                  {product.stock > 0 ? 'Buy Now' : 'Out of Stock'}
                </button>
              </div>

              {/* Stock Info */}
              <p>Only {product.stock} left in stock</p>
            </div>
          </section>

          {/* Details Section */}
          <section className="product-details">
            <h2>Product Details</h2>
            <ul>
              <li>Format: Digital 3D File</li>
              <li>Resolution: 4K</li>
              <li>File Type: .OBJ, .FBX</li>
              <li>License: Personal Use</li>
            </ul>
          </section>

          {/* Reviews Section */}
          <section className="reviews">
            <h2>Customer Reviews</h2>
            <div itemProp="review" itemScope itemType="https://schema.org/Review">
              <span itemProp="name">Great quality</span>
              <span itemProp="author">John Collector</span>
              <span
                itemProp="reviewRating"
                itemScope
                itemType="https://schema.org/Rating"
              >
                <span itemProp="ratingValue">5</span>/<span itemProp="bestRating">5</span>
              </span>
              <p itemProp="reviewBody">Great product, highly recommend!</p>
            </div>
          </section>
        </article>
      </main>
    </>
  );
}

/**
 * ============================================
 * BLOG/ARTICLE PAGE EXAMPLE
 * ============================================
 */
export function BlogPostExample() {
  const article = {
    slug: 'how-to-buy-nft-art',
    title: 'How to Buy Your First NFT Art on POPUP in 2026',
    description: 'A complete step-by-step guide for collectors new to buying digital art and NFTs.',
    image_url: 'https://example.com/blog-post.jpg',
    author: 'POPUP Team',
    published_date: '2026-04-01T00:00:00Z',
    updated_date: '2026-04-06T00:00:00Z',
    keywords: ['NFT', 'blockchain art', 'how to buy', 'beginner guide']
  };

  // Add full article content
  const content = `
    <h2>What are NFTs?</h2>
    <p>NFTs are digital assets...</p>
    
    <h2>Step 1: Set Up Your Wallet</h2>
    <p>First, you'll need a Web3 wallet...</p>
    
    <h2>Step 2: Get ETH in Your Wallet</h2>
    <p>You'll need ETH to purchase on POPUP...</p>
  `;

  const seoMeta = generateArticleSeo({ ...article, keywords: article.keywords.join(', ') });
  const breadcrumbs = getBreadcrumbs(`/blog/${article.slug}`);
  const schema = generateArticleSchema({ ...article, content });

  return (
    <>
      <SEOHead
        meta={seoMeta}
        schema={schema}
        breadcrumbs={breadcrumbs}
      />

      <main>
        <article itemScope itemType="https://schema.org/BlogPosting">
          <header>
            <h1 itemProp="headline">{article.title}</h1>
            <meta itemProp="image" content={article.image_url} />

            <div className="article-meta">
              <p>
                By{' '}
                <span
                  itemProp="author"
                  itemScope
                  itemType="https://schema.org/Person"
                >
                  <span itemProp="name">{article.author}</span>
                </span>
              </p>
              <time
                itemProp="datePublished"
                dateTime={article.published_date}
              >
                {new Date(article.published_date).toLocaleDateString()}
              </time>
              <meta
                itemProp="dateModified"
                content={article.updated_date}
              />
            </div>

            <img src={article.image_url} alt={article.title} />
          </header>

          <div
            itemProp="articleBody"
            dangerouslySetInnerHTML={{ __html: content }}
          />

          <footer className="article-footer">
            <div className="tags">
              {article.keywords.map(keyword => (
                <a key={keyword} href={`/blog?tag=${keyword}`}>
                  #{keyword}
                </a>
              ))}
            </div>

            <div className="share">
              <button>Share on Twitter</button>
              <button>Share on LinkedIn</button>
            </div>
          </footer>
        </article>

        {/* Related Articles */}
        <section className="related-articles">
          <h2>Related Articles</h2>
          {/* Related article cards */}
        </section>
      </main>
    </>
  );
}

/**
 * Usage Instructions:
 * 
 * 1. Import the appropriate page example
 * 2. Use in your Router:
 * 
 *    <Route path="/" element={<HomePageExample />} />
 *    <Route path="/artist/:artistId" element={<ArtistProfilePageExample />} />
 *    <Route path="/product/:productId" element={<ProductPageExample />} />
 *    <Route path="/blog/:slug" element={<BlogPostExample />} />
 * 
 * 3. Replace hardcoded data with actual API calls
 * 4. Test with Google Search Console
 */
