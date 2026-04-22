export type ProductType = "Guide" | "Course" | "Template" | "Tool" | "Ebook" | "Image";

export type ProductCard = {
  id: string;
  creatorId: string;
  title: string;
  creator: string;
  handle: string;
  type: ProductType;
  price: string;
  usdPrice: string;
  accent: string;
  summary: string;
  previewLabel: string;
  likes: number;
  gifts: number;
  collectedCount: string;
  salesCount: string;
  viewsCount: string;
  meta: string;
  badge?: string;
};

export type CreatorProfile = {
  id: string;
  name: string;
  handle: string;
  bio: string;
  accent: string;
  tokenId: string;
  role: string;
  website: string;
  xHandle: string;
  joined: string;
  stats: {
    products: string;
    collectors: string;
    volume: string;
    reviews: string;
  };
};

export type CollectorListing = {
  collector: string;
  pieces: string;
  ask: string;
  note: string;
};

export type TokenMarket = {
  id: string;
  creatorId: string;
  creator: string;
  token: string;
  floor: string;
  usdFloor: string;
  change: string;
  supply: string;
  liquidity: string;
  holders: string;
  holdersCount: number;
  marketCap: string;
  marketCapUsd: string;
  volume24h: string;
  volume24hUsd: string;
  network: string;
  contractAddress: string;
  fragmentModel: string;
  listings: CollectorListing[];
  trend: number[];
};

export type FeedStory = {
  id: string;
  label: string;
  creatorId?: string;
  accent: string;
  online?: boolean;
};

export type FeedPost = {
  id: string;
  creatorId: string;
  timeAgo: string;
  body: string[];
  primaryCta: string;
  previewType: "token" | "product";
  previewId: string;
  likes: number;
  comments: number;
  reposts: number;
};

export type DashboardMetric = {
  label: string;
  value: string;
  subvalue: string;
  change: string;
  icon: string;
};

export type DashboardSale = {
  collector: string;
  product: string;
  price: string;
  timeAgo: string;
};

export const creators: CreatorProfile[] = [
  {
    id: "nora-vale",
    name: "Nora Vale",
    handle: "@noravale",
    bio: "I create resources and tools to help creators launch, grow, and own their communities onchain.",
    accent: "linear-gradient(180deg, #2b2137 0%, #0f1522 100%)",
    tokenId: "nora-token",
    role: "Content Creator • Educator • Builder",
    website: "noravale.xyz",
    xHandle: "@noravale",
    joined: "Joined May 2024",
    stats: {
      products: "24",
      collectors: "8.2K",
      volume: "12.3 ETH",
      reviews: "98%",
    },
  },
  {
    id: "mika-rose",
    name: "Mika Rose",
    handle: "@mikarose",
    bio: "Video-first educator helping creators build, grow, and monetize community-powered launches.",
    accent: "linear-gradient(180deg, #4a245e 0%, #161924 100%)",
    tokenId: "mika-token",
    role: "Community Strategist • Course Creator",
    website: "mikarose.so",
    xHandle: "@mikarose",
    joined: "Joined Apr 2024",
    stats: {
      products: "18",
      collectors: "5.4K",
      volume: "8.7 ETH",
      reviews: "96%",
    },
  },
  {
    id: "zak-web3",
    name: "Zak Web3",
    handle: "@zakweb3",
    bio: "Research threads, token strategy breakdowns, and monetization frameworks for builders.",
    accent: "linear-gradient(180deg, #16304a 0%, #12161f 100%)",
    tokenId: "zak-token",
    role: "Analyst • Token Strategist",
    website: "zakweb3.co",
    xHandle: "@zakweb3",
    joined: "Joined Jan 2024",
    stats: {
      products: "16",
      collectors: "4.2K",
      volume: "6.1 ETH",
      reviews: "95%",
    },
  },
  {
    id: "drew-jackson",
    name: "Drew Jackson",
    handle: "@drewjxn",
    bio: "Systems and template drops designed for creators growing onchain audiences.",
    accent: "linear-gradient(180deg, #1c273f 0%, #141922 100%)",
    tokenId: "drew-token",
    role: "Designer • Systems Creator",
    website: "drewjackson.design",
    xHandle: "@drewjxn",
    joined: "Joined Feb 2024",
    stats: {
      products: "12",
      collectors: "3.7K",
      volume: "5.2 ETH",
      reviews: "97%",
    },
  },
  {
    id: "aria-chen",
    name: "Aria Chen",
    handle: "@ariachen",
    bio: "Elegant launch visuals, premium ebook drops, and collectible campaign assets.",
    accent: "linear-gradient(180deg, #382047 0%, #151823 100%)",
    tokenId: "aria-token",
    role: "Brand Designer • Ebook Creator",
    website: "ariachen.studio",
    xHandle: "@ariachen",
    joined: "Joined Mar 2024",
    stats: {
      products: "14",
      collectors: "4.8K",
      volume: "5.1 ETH",
      reviews: "94%",
    },
  },
  {
    id: "lexi-grant",
    name: "Lexi Grant",
    handle: "@lexigrant",
    bio: "Prompt packs, design systems, and premium access communities for independent creators.",
    accent: "linear-gradient(180deg, #3b1e36 0%, #151922 100%)",
    tokenId: "lexi-token",
    role: "Creative Technologist",
    website: "lexigrant.co",
    xHandle: "@lexigrant",
    joined: "Joined Feb 2024",
    stats: {
      products: "11",
      collectors: "3.1K",
      volume: "3.8 ETH",
      reviews: "93%",
    },
  },
  {
    id: "jay-co",
    name: "Jay Co",
    handle: "@jayco",
    bio: "Creator operations templates and systems for turning attention into sustainable revenue.",
    accent: "linear-gradient(180deg, #23304d 0%, #141a22 100%)",
    tokenId: "jay-token",
    role: "Operator • Template Builder",
    website: "jayco.tools",
    xHandle: "@jayco",
    joined: "Joined Jan 2024",
    stats: {
      products: "9",
      collectors: "2.4K",
      volume: "2.9 ETH",
      reviews: "92%",
    },
  },
  {
    id: "moon-collective",
    name: "Moon Collective",
    handle: "@moonco",
    bio: "A collective exploring drops, token access, and community-owned creator products.",
    accent: "linear-gradient(180deg, #2d2555 0%, #151922 100%)",
    tokenId: "moon-token",
    role: "Collective • Experimental Studio",
    website: "moonco.xyz",
    xHandle: "@moonco",
    joined: "Joined Apr 2024",
    stats: {
      products: "7",
      collectors: "1.8K",
      volume: "2.1 ETH",
      reviews: "95%",
    },
  },
];

export const featureCards: ProductCard[] = [
  {
    id: "drop-launch-playbook",
    creatorId: "nora-vale",
    title: "Launch Playbook for Creator Drops",
    creator: "Nora Vale",
    handle: "@noravale",
    type: "Guide",
    price: "0.02 ETH",
    usdPrice: "$39.60",
    accent: "linear-gradient(135deg, #171225 0%, #24173c 60%, #1b1f2f 100%)",
    summary: "A tactical 24-page guide for structuring digital drops, pricing access, and launching onchain.",
    previewLabel: "Preview",
    likes: 324,
    gifts: 48,
    collectedCount: "2.3K",
    salesCount: "689",
    viewsCount: "3.2K",
    meta: "24 Pages",
    badge: "Guide",
  },
  {
    id: "building-onchain-communities",
    creatorId: "mika-rose",
    title: "Building Onchain Communities",
    creator: "Mika Rose",
    handle: "@mikarose",
    type: "Course",
    price: "0.08 ETH",
    usdPrice: "$158.40",
    accent: "linear-gradient(135deg, #181229 0%, #2f1e52 55%, #111927 100%)",
    summary: "Step-by-step course to build, grow, and monetize your Web3 community.",
    previewLabel: "View",
    likes: 196,
    gifts: 18,
    collectedCount: "1.1K",
    salesCount: "312",
    viewsCount: "1.8K",
    meta: "5 Lessons",
    badge: "Video Course",
  },
  {
    id: "creator-dashboard-template",
    creatorId: "nora-vale",
    title: "Creator Dashboard (Notion Template)",
    creator: "Nora Vale",
    handle: "@noravale",
    type: "Template",
    price: "0.015 ETH",
    usdPrice: "$29.70",
    accent: "linear-gradient(135deg, #24294b 0%, #484f7f 40%, #171d31 100%)",
    summary: "Track your audience, content, sales, and drops in one place.",
    previewLabel: "Preview",
    likes: 124,
    gifts: 22,
    collectedCount: "1.8K",
    salesCount: "246",
    viewsCount: "2.1K",
    meta: "Notion",
    badge: "Template",
  },
  {
    id: "web3-growth-strategy",
    creatorId: "zak-web3",
    title: "Web3 Growth Strategy Guide",
    creator: "Zak Web3",
    handle: "@zakweb3",
    type: "Guide",
    price: "0.03 ETH",
    usdPrice: "$59.40",
    accent: "linear-gradient(135deg, #1b1634 0%, #33205e 55%, #101728 100%)",
    summary: "A focused guide to retention loops, token utility, and creator-led community growth.",
    previewLabel: "Preview",
    likes: 148,
    gifts: 20,
    collectedCount: "820",
    salesCount: "182",
    viewsCount: "1.2K",
    meta: "Guide",
    badge: "Guide",
  },
  {
    id: "token-launch-strategy",
    creatorId: "zak-web3",
    title: "Token Launch Strategy",
    creator: "Zak Web3",
    handle: "@zakweb3",
    type: "Guide",
    price: "0.03 ETH",
    usdPrice: "$59.40",
    accent: "linear-gradient(135deg, #13161f 0%, #181b29 50%, #1f3b2d 100%)",
    summary: "A tactical product for mapping token utility, launch sequencing, and early supporter rewards.",
    previewLabel: "Preview",
    likes: 102,
    gifts: 14,
    collectedCount: "540",
    salesCount: "98",
    viewsCount: "920",
    meta: "Guide",
    badge: "Guide",
  },
  {
    id: "notion-second-brain",
    creatorId: "jay-co",
    title: "Notion Second Brain",
    creator: "Jay Co",
    handle: "@jayco",
    type: "Template",
    price: "0.03 ETH",
    usdPrice: "$59.40",
    accent: "linear-gradient(135deg, #f3f0ec 0%, #e3ddd3 40%, #c6c0b7 100%)",
    summary: "A clean second-brain system for creators shipping content, launches, and ops in one place.",
    previewLabel: "Preview",
    likes: 89,
    gifts: 10,
    collectedCount: "740",
    salesCount: "172",
    viewsCount: "1.1K",
    meta: "Template",
    badge: "Template",
  },
  {
    id: "smart-contract-security",
    creatorId: "drew-jackson",
    title: "Smart Contract Security",
    creator: "Drew Jackson",
    handle: "@drewjxn",
    type: "Guide",
    price: "0.04 ETH",
    usdPrice: "$79.20",
    accent: "linear-gradient(135deg, #0f1e1d 0%, #16332f 50%, #142127 100%)",
    summary: "A pragmatic security guide for creators launching products with token-powered access.",
    previewLabel: "Preview",
    likes: 111,
    gifts: 15,
    collectedCount: "690",
    salesCount: "151",
    viewsCount: "980",
    meta: "Guide",
    badge: "Guide",
  },
  {
    id: "web3-design-system",
    creatorId: "aria-chen",
    title: "Web3 Design System",
    creator: "Aria Chen",
    handle: "@ariachen",
    type: "Tool",
    price: "0.02 ETH",
    usdPrice: "$39.60",
    accent: "linear-gradient(135deg, #171a3a 0%, #32235e 50%, #14182a 100%)",
    summary: "A polished UI kit for creator-token experiences, launch pages, and gated product flows.",
    previewLabel: "Preview",
    likes: 138,
    gifts: 19,
    collectedCount: "1.4K",
    salesCount: "202",
    viewsCount: "1.6K",
    meta: "Tool",
    badge: "Tool",
  },
];

export const marketplaceCards: TokenMarket[] = [
  {
    id: "nora-token",
    creatorId: "nora-vale",
    creator: "Nora Vale",
    token: "NORA",
    floor: "0.14 ETH",
    usdFloor: "$338.46",
    change: "+12.4%",
    supply: "2,400 fragments",
    liquidity: "48.2 ETH",
    holders: "382 holders",
    holdersCount: 382,
    marketCap: "56.4 ETH",
    marketCapUsd: "$136.5K",
    volume24h: "12.8 ETH",
    volume24hUsd: "$30.9K",
    network: "Ethereum",
    contractAddress: "0x71c3...8f2a",
    fragmentModel: "NORA aligns supporters with creator success through exclusive content, voting, and rewards.",
    trend: [6, 5, 4, 5, 6, 8, 7, 6, 8, 10, 9, 8, 12, 10, 11, 9, 10, 14, 13, 16],
    listings: [
      {
        collector: "Ada Joseph",
        pieces: "120 fragments",
        ask: "0.14 ETH",
        note: "Original drop collector listing part of the launch bag.",
      },
      {
        collector: "Milan Ko",
        pieces: "65 fragments",
        ask: "0.147 ETH",
        note: "Collector asking above floor after creator guide sold out.",
      },
      {
        collector: "Seyi T.",
        pieces: "220 fragments",
        ask: "0.152 ETH",
        note: "Largest visible listing in the current peer-to-peer market.",
      },
    ],
  },
  {
    id: "mika-token",
    creatorId: "mika-rose",
    creator: "Mika Rose",
    token: "MIKA",
    floor: "0.08 ETH",
    usdFloor: "$193.70",
    change: "+8.7%",
    supply: "1,800 fragments",
    liquidity: "24.6 ETH",
    holders: "214 holders",
    holdersCount: 214,
    marketCap: "24.6 ETH",
    marketCapUsd: "$59.6K",
    volume24h: "6.4 ETH",
    volume24hUsd: "$15.4K",
    network: "Ethereum",
    contractAddress: "0x83af...73bd",
    fragmentModel: "Fractional creator token trading between supporters who joined visual release campaigns.",
    trend: [4, 3, 2, 3, 3, 4, 5, 4, 7, 5, 6, 9, 8, 7, 9, 10, 8, 11, 10, 12],
    listings: [
      {
        collector: "Rin Park",
        pieces: "90 fragments",
        ask: "0.08 ETH",
        note: "Floor listing from an early course supporter.",
      },
      {
        collector: "Jules Morgan",
        pieces: "40 fragments",
        ask: "0.084 ETH",
        note: "Smaller lot split from a previous bundle buy.",
      },
    ],
  },
  {
    id: "drew-token",
    creatorId: "drew-jackson",
    creator: "Drew Jackson",
    token: "DREW",
    floor: "0.05 ETH",
    usdFloor: "$121.35",
    change: "+4.3%",
    supply: "1,250 fragments",
    liquidity: "13.4 ETH",
    holders: "156 holders",
    holdersCount: 156,
    marketCap: "15.2 ETH",
    marketCapUsd: "$36.8K",
    volume24h: "3.2 ETH",
    volume24hUsd: "$7.7K",
    network: "Ethereum",
    contractAddress: "0x22f1...a872",
    fragmentModel: "DREW gives holders early access to systems, templates, and drop experiments.",
    trend: [2, 2, 1, 2, 2, 3, 3, 4, 3, 4, 5, 4, 6, 5, 6, 5, 7, 6, 7, 8],
    listings: [
      {
        collector: "Theo B.",
        pieces: "70 fragments",
        ask: "0.052 ETH",
        note: "Premium ask from a holder keeping the rest of the bag.",
      },
    ],
  },
  {
    id: "lexi-token",
    creatorId: "lexi-grant",
    creator: "Lexi Grant",
    token: "LEXI",
    floor: "0.03 ETH",
    usdFloor: "$72.80",
    change: "-2.1%",
    supply: "940 fragments",
    liquidity: "8.7 ETH",
    holders: "98 holders",
    holdersCount: 98,
    marketCap: "9.8 ETH",
    marketCapUsd: "$23.7K",
    volume24h: "1.7 ETH",
    volume24hUsd: "$4.1K",
    network: "Ethereum",
    contractAddress: "0x5d1b...144e",
    fragmentModel: "LEXI unlocks prompt packs, studio notes, and drops from Lexi's creator system.",
    trend: [7, 6, 5, 4, 5, 6, 8, 9, 8, 7, 8, 6, 7, 6, 5, 4, 5, 4, 5, 4],
    listings: [
      {
        collector: "Mina A.",
        pieces: "55 fragments",
        ask: "0.031 ETH",
        note: "Micro-lot from an early prompt pack release.",
      },
    ],
  },
  {
    id: "zak-token",
    creatorId: "zak-web3",
    creator: "Zak Web3",
    token: "ZAK",
    floor: "0.02 ETH",
    usdFloor: "$48.56",
    change: "+15.6%",
    supply: "1,030 fragments",
    liquidity: "7.4 ETH",
    holders: "87 holders",
    holdersCount: 87,
    marketCap: "7.4 ETH",
    marketCapUsd: "$17.9K",
    volume24h: "2.4 ETH",
    volume24hUsd: "$5.8K",
    network: "Ethereum",
    contractAddress: "0x9842...2d18",
    fragmentModel: "ZAK rewards holders with market breakdowns, early access, and research drops.",
    trend: [2, 1, 1, 2, 3, 2, 4, 5, 4, 4, 6, 7, 6, 5, 7, 6, 8, 7, 8, 9],
    listings: [
      {
        collector: "Dami O.",
        pieces: "88 fragments",
        ask: "0.021 ETH",
        note: "Active ask from a research thread supporter.",
      },
    ],
  },
  {
    id: "aria-token",
    creatorId: "aria-chen",
    creator: "Aria Chen",
    token: "ARIA",
    floor: "0.015 ETH",
    usdFloor: "$36.42",
    change: "-1.8%",
    supply: "1,260 fragments",
    liquidity: "5.1 ETH",
    holders: "63 holders",
    holdersCount: 63,
    marketCap: "5.1 ETH",
    marketCapUsd: "$12.4K",
    volume24h: "1.2 ETH",
    volume24hUsd: "$2.9K",
    network: "Ethereum",
    contractAddress: "0x44de...0d93",
    fragmentModel: "ARIA gives supporters early access to design packs, moodboards, and creator launches.",
    trend: [4, 4, 3, 3, 4, 5, 5, 6, 5, 4, 7, 6, 5, 6, 5, 4, 5, 6, 5, 7],
    listings: [
      {
        collector: "Lina P.",
        pieces: "40 fragments",
        ask: "0.016 ETH",
        note: "Listing from an early ebook bundle collector.",
      },
    ],
  },
  {
    id: "jay-token",
    creatorId: "jay-co",
    creator: "Jay Co",
    token: "JAY",
    floor: "0.012 ETH",
    usdFloor: "$29.10",
    change: "+7.2%",
    supply: "780 fragments",
    liquidity: "3.6 ETH",
    holders: "51 holders",
    holdersCount: 51,
    marketCap: "3.6 ETH",
    marketCapUsd: "$8.7K",
    volume24h: "0.9 ETH",
    volume24hUsd: "$2.1K",
    network: "Ethereum",
    contractAddress: "0x9c5f...fa76",
    fragmentModel: "JAY powers templates, ops checklists, and private breakdowns from Jay's creator systems.",
    trend: [2, 2, 2, 3, 4, 3, 5, 6, 5, 7, 6, 4, 5, 6, 4, 5, 4, 5, 6, 7],
    listings: [
      {
        collector: "Yemi T.",
        pieces: "28 fragments",
        ask: "0.013 ETH",
        note: "Small ops-community lot available near floor.",
      },
    ],
  },
  {
    id: "moon-token",
    creatorId: "moon-collective",
    creator: "Moon Collective",
    token: "MOON",
    floor: "0.010 ETH",
    usdFloor: "$24.28",
    change: "+3.1%",
    supply: "650 fragments",
    liquidity: "2.9 ETH",
    holders: "44 holders",
    holdersCount: 44,
    marketCap: "2.9 ETH",
    marketCapUsd: "$7.0K",
    volume24h: "0.6 ETH",
    volume24hUsd: "$1.5K",
    network: "Ethereum",
    contractAddress: "0x17af...cb22",
    fragmentModel: "MOON grants community access, collaborative drops, and rewards for active participation.",
    trend: [1, 1, 0, 1, 2, 1, 2, 1, 3, 2, 1, 3, 2, 3, 2, 4, 3, 4, 4, 5],
    listings: [
      {
        collector: "Ari S.",
        pieces: "18 fragments",
        ask: "0.011 ETH",
        note: "Community lot from the first collective drop.",
      },
    ],
  },
];

export const feedStories: FeedStory[] = [
  { id: "explore", label: "Explore", accent: "linear-gradient(135deg, #4f2bff 0%, #9457ff 100%)" },
  { id: "nora-vale", creatorId: "nora-vale", label: "Nora Vale", accent: "linear-gradient(135deg, #3f31ff 0%, #c43df4 100%)", online: true },
  { id: "mika-rose", creatorId: "mika-rose", label: "Mika Rose", accent: "linear-gradient(135deg, #7f2bff 0%, #ff58a8 100%)", online: true },
  { id: "zak-web3", creatorId: "zak-web3", label: "Zak Web3", accent: "linear-gradient(135deg, #3380ff 0%, #a44bff 100%)", online: true },
  { id: "drew-jackson", creatorId: "drew-jackson", label: "Drew Jackson", accent: "linear-gradient(135deg, #2f71ff 0%, #9b55ff 100%)", online: true },
  { id: "aria-chen", creatorId: "aria-chen", label: "Aria Chen", accent: "linear-gradient(135deg, #c653ff 0%, #4b74ff 100%)", online: false },
];

export const feedPosts: FeedPost[] = [
  {
    id: "post-nora-token",
    creatorId: "nora-vale",
    timeAgo: "2h ago",
    body: [
      "Just launched my creator token $NORA",
      "This token powers my ecosystem and gives back to the community.",
      "Early supporters get exclusive access",
    ],
    primaryCta: "View token",
    previewType: "token",
    previewId: "nora-token",
    likes: 128,
    comments: 32,
    reposts: 24,
  },
  {
    id: "post-mika-course",
    creatorId: "mika-rose",
    timeAgo: "5h ago",
    body: [
      "Dropping a new course on building Web3 communities",
      "Token holders get 30% off",
    ],
    primaryCta: "View",
    previewType: "product",
    previewId: "building-onchain-communities",
    likes: 96,
    comments: 18,
    reposts: 12,
  },
  {
    id: "post-zak-guide",
    creatorId: "zak-web3",
    timeAgo: "7h ago",
    body: [
      "New strategy deck is live for early supporters.",
      "Breaking down utility design and launch timing for creator tokens.",
    ],
    primaryCta: "Open guide",
    previewType: "product",
    previewId: "token-launch-strategy",
    likes: 74,
    comments: 12,
    reposts: 9,
  },
];

export const dashboardMetrics: DashboardMetric[] = [
  { label: "Total Revenue", value: "12.3 ETH", subvalue: "$29,680.40", change: "+18.6%", icon: "$" },
  { label: "Total Sales", value: "1,429", subvalue: "", change: "+16.2%", icon: "Bag" },
  { label: "Total Views", value: "23.6K", subvalue: "", change: "+28.7%", icon: "Eye" },
  { label: "Conversion Rate", value: "6.1%", subvalue: "", change: "+5.3%", icon: "Chart" },
];

export const dashboardRecentSales: DashboardSale[] = [
  { collector: "0x8f3...a6b2", product: "Launch Playbook", price: "0.02 ETH", timeAgo: "2m ago" },
  { collector: "0x7ac...d8e1", product: "Building Communities", price: "0.08 ETH", timeAgo: "5m ago" },
  { collector: "0x91b...c4d2", product: "Notion Template", price: "0.015 ETH", timeAgo: "12m ago" },
  { collector: "0x35d...e7f1", product: "Web3 Growth Guide", price: "0.03 ETH", timeAgo: "18m ago" },
  { collector: "0x6aa...b2c9", product: "Launch Playbook", price: "0.02 ETH", timeAgo: "25m ago" },
];

export const revenueSeries = [0.02, 0.03, 0.08, 0.1, 0.3, 0.35, 0.34, 0.48, 0.55, 0.46, 0.72, 0.54, 0.46, 0.6, 0.66, 0.98, 0.93, 0.85, 1.1, 1.28, 1.52, 1.02, 0.92, 1.22, 1.28, 1.38, 1.12, 1.2, 1.32, 1.46, 1.72, 1.28, 1.16, 1.12, 1.28];

export function getCreatorById(creatorId: string) {
  return creators.find((creator) => creator.id === creatorId);
}

export function getTokenById(tokenId: string) {
  return marketplaceCards.find((token) => token.id === tokenId);
}

export function getProductsByCreator(creatorId: string) {
  return featureCards.filter((product) => product.creatorId === creatorId);
}

export function getProductById(productId: string) {
  return featureCards.find((product) => product.id === productId);
}
