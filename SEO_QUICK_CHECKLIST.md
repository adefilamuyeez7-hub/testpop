# POPUP SEO Quick Start Checklist

## Pre-Launch SEO (Critical - Do First)

### Technical SEO
- [ ] Add meta title/description to all pages (max 60 chars title, 160 chars description)
- [ ] Add Open Graph tags (og:title, og:description, og:image, og:url)
- [ ] Add Twitter card tags (twitter:card, twitter:title, twitter:description, twitter:image)
- [ ] Create JSON-LD schema markup for:
  - [ ] Homepage (Organization schema)
  - [ ] Artist profiles (Person schema)
  - [ ] Products (Product schema)
  - [ ] Collections (CollectionPage schema)
  - [ ] Breadcrumbs (BreadcrumbList schema)
- [ ] Create robots.txt file
- [ ] Generate XML sitemap (auto-updated)
- [ ] Submit to Google Search Console
- [ ] Submit to Bing Webmaster Tools
- [ ] Fix all crawlability issues
- [ ] Ensure mobile responsiveness
- [ ] Test Core Web Vitals (Lighthouse score 90+)
- [ ] Enable gzip compression
- [ ] Implement image optimization (WebP, lazy loading)
- [ ] Add canonical tags to avoid duplicates
- [ ] Implement internal linking strategy
- [ ] Create 404 page with helpful links

### Content SEO
- [ ] Optimize homepage H1 and meta tags
- [ ] Add FAQ section to homepage
- [ ] Optimize artist profile template with:
  - [ ] Unique H1 tag per artist
  - [ ] Dynamic meta description
  - [ ] Schema markup for artist
  - [ ] Related artists section
- [ ] Create product description best practices guide
- [ ] Optimize collection/drop pages

### Analytics & Monitoring
- [ ] Set up Google Analytics 4 (GA4)
- [ ] Link GA4 to Google Search Console
- [ ] Create conversion goals:
  - [ ] Sign up / Register
  - [ ] Artist subscription
  - [ ] Product purchase
  - [ ] Artist applies
  - [ ] Newsletter signup
- [ ] Set up branded keyword alerts
- [ ] Create monthly SEO report template

---

## Content Creation (Target: 20+ posts in 3 months)

### Blog Topics - Week 1
- [ ] "What Are NFT Drops? Beginner's Guide" (2,000 words)
- [ ] "How to Buy NFTs on POPUP in 2026" (1,500 words)
- [ ] "Artist Subscriptions vs NFTs: Which is Better?" (1,500 words)

### Blog Topics - Week 2-4
- [ ] Create 8-12 more targeted blog posts
- [ ] Each post targets 1 primary + 3-5 secondary keywords
- [ ] Each post 1,500+ words
- [ ] Each post includes internal links (5-7 links minimum)
- [ ] Each post includes CTA to artist studio or browse page

### Guest Posting
- [ ] Identify 10 target sites (crypto + art blogs)
- [ ] Pitch 3-5 guest post ideas
- [ ] Write and publish guest posts with backlinks

---

## Link Building (Target: 50+ quality backlinks)

### PR & Outreach
- [ ] Write 1-2 press releases about major features
- [ ] Send to 20+ crypto/NFT news outlets
- [ ] Reach out to 15 crypto/art blogs for features

### Community Building
- [ ] Engage in r/NFT, r/DigitalArt subreddits
- [ ] Create Twitter/X content calendar (1-2 tweets daily)
- [ ] Start Mirror.xyz blog (weekly posts)
- [ ] Participate in Web3 communities
- [ ] Feature artist spotlights on social media

### Natural Links
- [ ] Create link-worthy resources (industry reports, guides)
- [ ] Create interactive tools for designers/artists
- [ ] Get featured in NFT/art publications

---

## Artist/Creator Discoverability

- [ ] Create artist directory page (/artists)
- [ ] Add artist filtering by category/style
- [ ] Implement artist search functionality
- [ ] Create artist collection pages (all drops/products on one page)
- [ ] Add "Featured Artists" section to homepage (with rotating artists)
- [ ] Create artist leaderboards (most subscribed, trending, etc.)
- [ ] Implement artist comparison tool (side-by-side)
- [ ] Add artist recommendations based on browsing history
- [ ] Create "New Artists" section (latest to join)
- [ ] Implement artist recommendations on product pages

---

## Technical Optimizations

### Performance (Core Web Vitals)
- [ ] LCP (Largest Contentful Paint) < 2.5s
  - [ ] Prioritize hero image loading
  - [ ] Defer non-critical JavaScript
  - [ ] Use Image CDN (Vercel Image Optimization)
- [ ] FID (First Input Delay) < 100ms
  - [ ] Reduce JavaScript execution
  - [ ] Code split React components
  - [ ] Use web workers for heavy tasks
- [ ] CLS (Cumulative Layout Shift) < 0.1
  - [ ] Reserve space for images
  - [ ] Avoid unsized images/ads
  - [ ] Predefine font sizes

### Mobile
- [ ] Mobile-first design audit
- [ ] Test on iPhone 12, Samsung Galaxy S21
- [ ] Verify touch targets are 48x48px minimum
- [ ] Check mobile navigation is intuitive
- [ ] Test form submission on mobile

### Security & HTTPS
- [ ] Enable HTTPS (auto via Vercel)
- [ ] Implement security headers
- [ ] Add CSP (Content Security Policy)
- [ ] Test SSL certificate validity

---

## Competitive Analysis

- [ ] Monitor OpenSea SEO strategy
- [ ] Monitor Foundation marketplace SEO
- [ ] Check top 5 competitors' keywords
- [ ] Identify content gaps
- [ ] Find link opportunities (get links from sites linking to competitors)
- [ ] Analyze competitor backlink profiles

---

## Monthly Maintenance Checklist

### Week 1
- [ ] Check Search Console for errors
- [ ] Review crawl statistics
- [ ] Audit new backlinks
- [ ] Check Core Web Vitals metrics

### Week 2
- [ ] Publish 2 new blog posts
- [ ] Reach out for 1 guest posting opportunity
- [ ] Analyze top performing content
- [ ] Optimize underperforming content

### Week 3
- [ ] Analyze search rankings (tool: Semrush/Ahrefs)
- [ ] Review GA4 conversion data
- [ ] Check for new keyword opportunities
- [ ] Monitor competitor activity

### Week 4
- [ ] Create monthly SEO report
- [ ] Plan next month's content
- [ ] Review and update existing blog posts
- [ ] Analyze backlink growth

---

## Success Indicators

### Month 1-2
- [ ] 50+ keywords showing in Search Console
- [ ] 5+ new organic sessions daily
- [ ] 5-10 new blog posts published
- [ ] 10+ backlinks acquired

### Month 3-4
- [ ] 200+ keywords showing in Search Console
- [ ] 50-100 organic sessions daily
- [ ] 15+ blog posts published
- [ ] 25+ backlinks acquired
- [ ] 3+ keywords ranking in top 10

### Month 5-6
- [ ] 500+ keywords showing in Search Console
- [ ] 200-300 organic sessions daily
- [ ] 20+ blog posts published (20+ total)
- [ ] 50+ backlinks acquired
- [ ] 10+ keywords ranking in top 10

---

## Tools & Services to Set Up

### Free
- [x] Google Search Console
- [x] Google Analytics 4
- [x] Bing Webmaster Tools
- [x] Google PageSpeed Insights
- [x] Screaming Frog SEO Spider (limited)

### Paid (Recommended)
- [ ] Semrush ($99-200/month) - keyword tracking, content ideas
- [ ] Ahrefs ($99-200/month) - backlink analysis, gap analysis
- [ ] Moz Pro ($99/month) - rank tracking
- [ ] Copyscape ($5-100/month) - duplicate content detection
- [ ] Upstat ($10/month) - competitor monitoring

### Implementation
```bash
npm install react-helmet-async
npm install next-seo  # If using Next.js
npm install web-vitals
npm install @vercel/og  # Dynamic OG images
```

---

## Resources & Learning

### SEO Reading
- Moz Beginner's Guide to SEO
- Google Search Central (official documentation)
- Brian Dean - Backlinko blog
- Daniel Ospina - SEO blog

### Tools
- SEO Stack: https://www.thehoth.com/open-source-seo-tools/
- JSON-LD Schema Generator: https://jsonld.com/
- Meta Tag Generator: https://metatags.io

### Communities
- r/SEO
- SEO Subreddits
- Twitter/X: Follow @searchliaison (Google), @MattGSEO
- LinkedIn: Follow Neil Patel, Brian Dean

---

## Questions to Answer Monthly

1. What are my top 10 organic keywords?
2. Which pages drove the most organic traffic?
3. What is my average ranking position?
4. How much organic revenue was generated?
5. Which blog posts performed best?
6. What keywords am I missing?
7. Who is linking to me?
8. How fast is my site?
9. What's my bounce rate and why?
10. What's my next priority?

---

## Notes

- Start with Phase 1 immediately (foundation)
- Focus on content quality over quantity
- Build authority through consistent effort
- Track everything; optimize based on data
- Be patient; SEO takes 3-6 months to show results
- Keep an SEO journal to document learnings
- Share SEO wins with the team
- Celebrate small wins (first ranking, first organic sale)

---

**Target Goal**: 15,000+ organic monthly sessions by Month 6, generating 5-10% of total platform revenue from organic search.

**Start Date**: Week of April 7, 2026  
**Review Date**: July 7, 2026 (3-month review)
