/**
 * SEO Head Component
 * Location: src/components/seo/SEOHead.tsx
 * Purpose: Reusable component for setting up SEO meta tags and schema
 * 
 * Usage:
 * <SEOHead 
 *   meta={generateArtistProfileSeo(artist)}
 *   schema={generateArtistSchema(artist)}
 *   breadcrumbs={breadcrumbs}
 * />
 */

import { Helmet } from 'react-helmet-async';
import type { SeoMetaTags } from '@/utils/seo';
import { getCanonicalUrl } from '@/utils/seo';

interface SEOHeadProps {
  meta: SeoMetaTags;
  schema?: Record<string, any> | Record<string, any>[];
  breadcrumbs?: Array<{ label: string; url: string }>;
  children?: React.ReactNode;
}

/**
 * SEOHead Component - Sets up all necessary meta tags and structured data
 */
export function SEOHead({ meta, schema, breadcrumbs, children }: SEOHeadProps) {
  const canonicalUrl = getCanonicalUrl(meta.url.replace('https://testpop-one.vercel.app', ''));

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{meta.title}</title>
      <meta name="description" content={meta.description} />
      <meta name="keywords" content={meta.keywords} />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta charSet="utf-8" />

      {/* Canonical URL - Prevent duplicate content */}
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph Tags - Social Media Sharing */}
      <meta property="og:title" content={meta.title} />
      <meta property="og:description" content={meta.description} />
      <meta property="og:image" content={meta.image} />
      <meta property="og:url" content={meta.url} />
      <meta property="og:type" content={meta.type} />
      <meta property="og:site_name" content="POPUP" />

      {/* Twitter Card Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={meta.title} />
      <meta name="twitter:description" content={meta.description} />
      <meta name="twitter:image" content={meta.image} />
      <meta name="twitter:site" content="@popupnft" />

      {/* Author & Publishing Info */}
      {meta.author && <meta name="author" content={meta.author} />}
      {meta.publishDate && <meta property="article:published_time" content={meta.publishDate} />}
      {meta.updatedDate && <meta property="article:modified_time" content={meta.updatedDate} />}

      {/* Additional SEO Meta Tags */}
      <meta name="robots" content="index, follow" />
      <meta name="googlebot" content="index, follow" />
      <meta httpEquiv="x-ua-compatible" content="IE=edge" />

      {/* Favicon & Icons */}
      <link rel="icon" href="/favicon.ico" />
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

      {/* JSON-LD Structured Data */}
      {schema && (
        <script type="application/ld+json">
          {Array.isArray(schema) 
            ? JSON.stringify({
                '@context': 'https://schema.org',
                '@graph': schema
              })
            : JSON.stringify(schema)
          }
        </script>
      )}

      {/* Breadcrumb Schema */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: breadcrumbs.map((item, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              name: item.label,
              item: `https://testpop-one.vercel.app${item.url}`
            }))
          })}
        </script>
      )}

      {/* Preload Critical Resources */}
      <link rel="preload" as="image" href={meta.image} />

      {/* DNS Prefetch for External Resources */}
      <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
      <link rel="dns-prefetch" href="https://www.google-analytics.com" />

      {/* Preconnect to Critical Origins */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />

      {/* Additional children */}
      {children}
    </Helmet>
  );
}

/**
 * Simple meta tag component for basic SEO
 * Use when full SEOHead is overkill
 */
export function SimpleMetaTags({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
    </Helmet>
  );
}

/**
 * Product Page Meta Tags & Schema
 */
export function ProductSEOHead({
  title,
  description,
  image,
  price,
  currency = 'ETH',
  availability = 'InStock'
}: {
  title: string;
  description: string;
  image: string;
  price?: string;
  currency?: string;
  availability?: string;
}) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: title,
    description,
    image,
    offers: {
      '@type': 'Offer',
      price,
      priceCurrency: currency,
      availability: `https://schema.org/${availability}`
    }
  };

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:type" content="product" />
      <meta name="twitter:card" content="summary_large_image" />
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Helmet>
  );
}

/**
 * Article Page Meta Tags & Schema
 */
export function ArticleSEOHead({
  title,
  description,
  image,
  author,
  publishDate,
  modifiedDate
}: {
  title: string;
  description: string;
  image: string;
  author: string;
  publishDate: string;
  modifiedDate?: string;
}) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description,
    image,
    author: {
      '@type': 'Person',
      name: author
    },
    datePublished: publishDate,
    dateModified: modifiedDate || publishDate
  };

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:type" content="article" />
      <meta property="article:author" content={author} />
      <meta property="article:published_time" content={publishDate} />
      {modifiedDate && <meta property="article:modified_time" content={modifiedDate} />}
      <meta name="twitter:card" content="summary_large_image" />
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Helmet>
  );
}
