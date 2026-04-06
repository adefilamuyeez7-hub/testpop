/**
 * JSON-LD Schema Markup Generation
 * Location: src/utils/schema.ts
 * Purpose: Generate structured data for search engines
 */

/**
 * Organization Schema - Main website identity
 */
export const generateOrganizationSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'POPUP',
  url: 'https://testpop-one.vercel.app',
  logo: 'https://testpop-one.vercel.app/logo.png',
  description: 'Web3 creator platform for NFT art and subscriptions',
  sameAs: [
    'https://twitter.com/popupnft',
    'https://instagram.com/popupnft',
    'https://discord.gg/popup'
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'Customer Service',
    url: 'https://testpop-one.vercel.app/contact'
  }
});

/**
 * Artist/Creator Schema
 */
export const generateArtistSchema = (artist: {
  id: string;
  name: string;
  bio?: string;
  avatar_url?: string;
  location?: string;
  twitter_url?: string;
  instagram_url?: string;
  url?: string;
  subscribers_count?: number;
  drops_count?: number;
}) => {
  const socials = [artist.twitter_url, artist.instagram_url].filter(Boolean) as string[];

  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: artist.name,
    url: artist.url || `https://testpop-one.vercel.app/artist/${artist.id}`,
    image: artist.avatar_url,
    description: artist.bio,
    jobTitle: 'Digital Artist',
    knowsAbout: ['Digital Art', 'NFT', 'Web3', 'Blockchain Art'],
    workLocation: {
      '@type': 'Place',
      name: artist.location || 'Online'
    },
    sameAs: socials.length > 0 ? socials : undefined,
    // Creator-specific
    creatorCount: artist.subscribers_count || 0,
    worksCount: artist.drops_count || 0
  };
};

/**
 * Product Schema - For NFTs and digital products
 */
export const generateProductSchema = (product: {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  price_eth?: number;
  creator_name?: string;
  stock?: number;
  rating?: number;
  review_count?: number;
  url?: string;
}) => {
  const schema: any = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: [product.image_url],
    url: product.url || `https://testpop-one.vercel.app/product/${product.id}`,
    brand: {
      '@type': 'Brand',
      name: product.creator_name || 'POPUP Artist'
    },
    offers: {
      '@type': 'Offer',
      price: product.price_eth?.toString() || '0',
      priceCurrency: 'ETH',
      availability: product.stock && product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: product.url || `https://testpop-one.vercel.app/product/${product.id}`
    }
  };

  // Add rating if available
  if (product.rating && product.review_count) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: product.rating.toString(),
      ratingCount: product.review_count
    };
  }

  return schema;
};

/**
 * Breadcrumb List Schema - For navigation hierarchy
 */
export const generateBreadcrumbSchema = (breadcrumbs: Array<{ label: string; url: string }>) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: breadcrumbs.map((item, index) => ({
    '@type': 'ListItem',
    position: (index + 1).toString(),
    name: item.label,
    item: item.url
  }))
});

/**
 * Collection/Drop Schema
 */
export const generateCollectionSchema = (collection: {
  id: string;
  title: string;
  description?: string;
  image_url?: string;
  artist_name?: string;
  item_count?: number;
  created_at?: string;
  url?: string;
}) => ({
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: collection.title,
  description: collection.description,
  image: collection.image_url,
  url: collection.url || `https://testpop-one.vercel.app/drop/${collection.id}`,
  creator: {
    '@type': 'Person',
    name: collection.artist_name || 'Unknown Artist'
  },
  datePublished: collection.created_at,
  numberOfItems: collection.item_count || 0
});

/**
 * Article/Blog Post Schema
 */
export const generateArticleSchema = (article: {
  slug: string;
  title: string;
  description: string;
  image_url: string;
  author: string;
  published_date: string;
  updated_date?: string;
  content?: string;
  url?: string;
}) => ({
  '@context': 'https://schema.org',
  '@type': 'BlogPosting',
  headline: article.title,
  description: article.description,
  image: [article.image_url],
  datePublished: article.published_date,
  dateModified: article.updated_date || article.published_date,
  author: {
    '@type': 'Person',
    name: article.author,
    url: 'https://testpop-one.vercel.app'
  },
  publisher: {
    '@type': 'Organization',
    name: 'POPUP',
    url: 'https://testpop-one.vercel.app'
  },
  mainEntityOfPage: {
    '@type': 'WebPage',
    '@id': article.url || `https://testpop-one.vercel.app/blog/${article.slug}`
  },
  articleBody: article.content,
  url: article.url || `https://testpop-one.vercel.app/blog/${article.slug}`
});

/**
 * Local Business Schema (if applicable)
 */
export const generateLocalBusinessSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'POPUP',
  url: 'https://testpop-one.vercel.app',
  telephone: '+1-XXX-XXX-XXXX',
  email: 'support@testpop-one.vercel.app',
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'US'
  },
  openingHours: 'Mo-Su 00:00-23:59'
});

/**
 * Event Schema (for drops, launches, etc.)
 */
export const generateEventSchema = (event: {
  name: string;
  description?: string;
  image?: string;
  start_date: string;
  end_date?: string;
  url?: string;
  location?: string;
}) => ({
  '@context': 'https://schema.org',
  '@type': 'Event',
  name: event.name,
  description: event.description,
  image: event.image,
  startDate: event.start_date,
  endDate: event.end_date || event.start_date,
  url: event.url,
  ...(event.location && {
    location: {
      '@type': 'Place',
      name: event.location,
      url: event.location
    }
  })
});

/**
 * FAQ Schema
 */
export const generateFAQSchema = (faqs: Array<{ question: string; answer: string }>) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map(faq => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.answer
    }
  }))
});

/**
 * Review Schema
 */
export const generateReviewSchema = (review: {
  author: string;
  rating: number;
  comment: string;
  date: string;
  item_name: string;
}) => ({
  '@context': 'https://schema.org',
  '@type': 'Review',
  author: {
    '@type': 'Person',
    name: review.author
  },
  reviewRating: {
    '@type': 'Rating',
    ratingValue: review.rating.toString(),
    bestRating: '5',
    worstRating: '1'
  },
  reviewBody: review.comment,
  datePublished: review.date,
  itemReviewed: {
    '@type': 'Thing',
    name: review.item_name
  }
});

/**
 * Helper to generate schema script tag
 * Usage: <JsonLdScript data={generateArtistSchema(artist)} />
 */
export const createJsonLdScript = (data: any): string => {
  return JSON.stringify(data);
};
