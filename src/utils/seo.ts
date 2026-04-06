/**
 * SEO Utilities - Dynamic Meta Tag Generation
 * Location: src/utils/seo.ts
 * Purpose: Generate SEO-optimized meta tags for all pages
 */

export interface SeoMetaTags {
  title: string;
  description: string;
  keywords: string;
  image: string;
  url: string;
  type: 'website' | 'article' | 'product' | 'profile';
  author?: string;
  publishDate?: string;
  updatedDate?: string;
}

const BASE_URL = 'https://testpop-one.vercel.app';
const BRAND_NAME = 'POPUP';

/**
 * Generate SEO meta tags for home page
 */
export const generateHomeSeo = (): SeoMetaTags => ({
  title: 'POPUP - Web3 Creator Platform | NFT Art & Subscriptions',
  description: 'Discover talented artists, collect NFT art, and subscribe to creators on the Web3 creator economy platform. Buy digital art, support creators directly.',
  keywords: 'NFT art, creator subscription, Web3 artists, digital art marketplace, cryptocurrency, blockchain art',
  image: `${BASE_URL}/og-home.png`,
  url: BASE_URL,
  type: 'website',
});

/**
 * Generate SEO meta tags for browse/explore page
 */
export const generateBrowseSeo = (): SeoMetaTags => ({
  title: 'Browse Artists & Collections - POPUP | Discover NFT Art',
  description: 'Explore trending NFT artists, exclusive drops, and creative works from digital creators worldwide on POPUP.',
  keywords: 'NFT marketplace, artist directory, digital art, Web3 creators, art collections, NFT drops',
  image: `${BASE_URL}/og-browse.png`,
  url: `${BASE_URL}/browse`,
  type: 'website',
});

/**
 * Generate SEO meta tags for artist studio/dashboard
 */
export const generateStudioSeo = (): SeoMetaTags => ({
  title: 'Artist Studio Dashboard - POPUP | Manage NFT Drops & Subscriptions',
  description: 'Manage your NFT drops, subscriptions, and product sales from your personal artist dashboard. Analyze earnings and engage with collectors.',
  keywords: 'artist dashboard, NFT creator tools, subscription management, NFT analytics',
  image: `${BASE_URL}/og-studio.png`,
  url: `${BASE_URL}/studio`,
  type: 'website',
});

/**
 * Generate SEO meta tags for individual artist profile
 */
export const generateArtistProfileSeo = (artist: {
  id: string;
  name: string;
  bio?: string;
  avatar_url?: string;
  twitter_url?: string;
  instagram_url?: string;
  updated_at?: string;
}): SeoMetaTags => ({
  title: `${artist.name} - Digital Artist on POPUP | NFT Drops & Subscriptions`,
  description: `${artist.bio || `Discover ${artist.name}'s NFT collections and exclusive digital art`} View drops, subscribe to ${artist.name}, and buy digital products on POPUP.`,
  keywords: `${artist.name}, NFT artist, digital creator, Web3 art, digital artist, NFT drops`,
  image: artist.avatar_url || `${BASE_URL}/og-artist.png`,
  url: `${BASE_URL}/artist/${artist.id}`,
  type: 'profile',
  updatedDate: artist.updated_at,
});

/**
 * Generate SEO meta tags for product page
 */
export const generateProductSeo = (product: {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  price_eth?: number;
  creator_name?: string;
  updated_at?: string;
}): SeoMetaTags => ({
  title: `${product.name} by ${product.creator_name || 'Artist'} - POPUP Marketplace`,
  description: `${product.description || `Buy ${product.name} now on POPUP`} ${product.price_eth ? `Price: ${product.price_eth} ETH` : ''}. Limited edition digital product from ${product.creator_name}.`,
  keywords: `${product.name}, ${product.creator_name}, NFT, digital product, blockchain art`,
  image: product.image_url || `${BASE_URL}/og-product.png`,
  url: `${BASE_URL}/product/${product.id}`,
  type: 'product',
  updatedDate: product.updated_at,
});

/**
 * Generate SEO meta tags for collection/drop page
 */
export const generateDropSeo = (drop: {
  id: string;
  title: string;
  description?: string;
  image_url?: string;
  artist_name?: string;
  created_at?: string;
}): SeoMetaTags => ({
  title: `${drop.title} - NFT Drop by ${drop.artist_name || 'Artist'} | POPUP`,
  description: `${drop.description || `Collect ${drop.title}`}. Exclusive NFT drop from ${drop.artist_name}. Limited edition digital art on POPUP.`,
  keywords: `${drop.title}, NFT drop, ${drop.artist_name}, digital art collection, exclusive NFT`,
  image: drop.image_url || `${BASE_URL}/og-drop.png`,
  url: `${BASE_URL}/drop/${drop.id}`,
  type: 'product',
  publishDate: drop.created_at,
});

/**
 * Generate SEO meta tags for blog/article page
 */
export const generateArticleSeo = (article: {
  slug: string;
  title: string;
  description: string;
  image_url: string;
  author: string;
  published_date: string;
  updated_date?: string;
  keywords: string[];
}): SeoMetaTags => ({
  title: `${article.title} - POPUP Blog`,
  description: article.description,
  keywords: article.keywords.join(', '),
  image: article.image_url,
  url: `${BASE_URL}/blog/${article.slug}`,
  type: 'article',
  author: article.author,
  publishDate: article.published_date,
  updatedDate: article.updated_date,
});

/**
 * Get breadcrumb navigation for current page
 */
export const getBreadcrumbs = (pathname: string): Array<{ label: string; url: string }> => {
  const breadcrumbs: Array<{ label: string; url: string }> = [
    { label: 'Home', url: '/' },
  ];

  if (pathname.includes('/artist/')) {
    breadcrumbs.push({ label: 'Artists', url: '/browse' });
    breadcrumbs.push({ label: 'Artist Profile', url: pathname });
  } else if (pathname.includes('/product/')) {
    breadcrumbs.push({ label: 'Products', url: '/browse' });
    breadcrumbs.push({ label: 'Product', url: pathname });
  } else if (pathname.includes('/drop/')) {
    breadcrumbs.push({ label: 'Collections', url: '/browse' });
    breadcrumbs.push({ label: 'Drop', url: pathname });
  } else if (pathname.includes('/studio')) {
    breadcrumbs.push({ label: 'Studio', url: '/studio' });
  } else if (pathname.includes('/browse')) {
    breadcrumbs.push({ label: 'Browse', url: '/browse' });
  }

  return breadcrumbs;
};

/**
 * Generate canonical URL (to avoid duplicate content)
 */
export const getCanonicalUrl = (pathname: string): string => {
  return `${BASE_URL}${pathname}`;
};

/**
 * Sanitize meta description to proper length
 */
export const sanitizeDescription = (description: string, maxLength = 160): string => {
  if (description.length <= maxLength) {
    return description;
  }
  return `${description.substring(0, maxLength - 3)}...`;
};

/**
 * Sanitize title to proper length
 */
export const sanitizeTitle = (title: string, maxLength = 60): string => {
  if (title.length <= maxLength) {
    return title;
  }
  return `${title.substring(0, maxLength - 3)}...`;
};

/**
 * Format keyword list for meta tags
 */
export const formatKeywords = (keywords: string[]): string => {
  return keywords.join(', ').substring(0, 200);
};
