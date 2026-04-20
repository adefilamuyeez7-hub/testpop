export type ProductType = "PDF" | "Image" | "Tool";

export type ProductCard = {
  id: string;
  creatorId: string;
  title: string;
  creator: string;
  handle: string;
  type: ProductType;
  price: string;
  accent: string;
  summary: string;
  previewLabel: string;
  likes: number;
  gifts: number;
};

export type CreatorProfile = {
  id: string;
  name: string;
  handle: string;
  bio: string;
  accent: string;
  tokenId: string;
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
  change: string;
  supply: string;
  liquidity: string;
  holders: string;
  fragmentModel: string;
  listings: CollectorListing[];
};

export const creators: CreatorProfile[] = [
  {
    id: "nora-vale",
    name: "Nora Vale",
    handle: "@noravale",
    bio: "Creator education drops, launch docs, and collectible publishing systems.",
    accent: "var(--accent-peach)",
    tokenId: "nora-token",
  },
  {
    id: "mika-rose",
    name: "Mika Rose",
    handle: "@mikarose",
    bio: "Visual brand kits, campaign posters, and digital image packs for creator launches.",
    accent: "var(--accent-lilac)",
    tokenId: "mika-token",
  },
  {
    id: "kemi-hart",
    name: "Kemi Hart",
    handle: "@kemihart",
    bio: "Toolkits and structured systems for audience growth and collector operations.",
    accent: "var(--accent-mint)",
    tokenId: "kemi-token",
  },
  {
    id: "rhea-saint",
    name: "Rhea Saint",
    handle: "@rheasaint",
    bio: "Mixed-media drop artist building collectible image releases and token-gated assets.",
    accent: "var(--accent-sky)",
    tokenId: "rhea-token",
  },
];

export const featureCards: ProductCard[] = [
  {
    id: "drop-launch-playbook",
    creatorId: "nora-vale",
    title: "Launch playbook for a creator drop",
    creator: "Nora Vale",
    handle: "@noravale",
    type: "PDF",
    price: "0.02 ETH",
    accent: "var(--accent-peach)",
    summary: "A tactical 24-page guide for structuring a digital drop, pricing access, and launching onchain.",
    previewLabel: "Read preview",
    likes: 184,
    gifts: 28,
  },
  {
    id: "drop-brand-kit",
    creatorId: "mika-rose",
    title: "Motion poster pack for launch week",
    creator: "Mika Rose",
    handle: "@mikarose",
    type: "Image",
    price: "Free",
    accent: "var(--accent-lilac)",
    summary: "A polished image set for stories, feed teasers, and creator token campaign posts.",
    previewLabel: "Open preview",
    likes: 246,
    gifts: 34,
  },
  {
    id: "drop-audience-tracker",
    creatorId: "kemi-hart",
    title: "Audience tracker toolkit",
    creator: "Kemi Hart",
    handle: "@kemihart",
    type: "Tool",
    price: "0.05 ETH",
    accent: "var(--accent-mint)",
    summary: "A downloadable operating system for collectors, campaign performance, and referral tracking.",
    previewLabel: "See toolkit",
    likes: 132,
    gifts: 21,
  },
  {
    id: "drop-gallery-capsules",
    creatorId: "rhea-saint",
    title: "Gallery capsules vol. 01",
    creator: "Rhea Saint",
    handle: "@rheasaint",
    type: "Image",
    price: "0.03 ETH",
    accent: "var(--accent-sky)",
    summary: "A collectible image release with layered stills designed for full-screen mobile discovery.",
    previewLabel: "View capsule",
    likes: 97,
    gifts: 16,
  },
];

export const marketplaceCards: TokenMarket[] = [
  {
    id: "nora-token",
    creatorId: "nora-vale",
    creator: "Nora Vale",
    token: "NORA",
    floor: "0.14 ETH",
    change: "+12.4%",
    supply: "2,400 fragments",
    liquidity: "48.2 ETH",
    holders: "382 holders",
    fragmentModel: "Fragmented creator token backed by release participation and collector liquidity.",
    listings: [
      {
        collector: "Ada Joseph",
        pieces: "120 fragments",
        ask: "0.14 ETH",
        note: "Original drop collector listing part of launch bag.",
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
        note: "Largest visible collector listing in the current peer-to-peer market.",
      },
    ],
  },
  {
    id: "mika-token",
    creatorId: "mika-rose",
    creator: "Mika Rose",
    token: "MIKA",
    floor: "0.09 ETH",
    change: "+4.8%",
    supply: "1,800 fragments",
    liquidity: "24.6 ETH",
    holders: "214 holders",
    fragmentModel: "Fractional creator token trading between collectors who joined visual release campaigns.",
    listings: [
      {
        collector: "Rin Park",
        pieces: "90 fragments",
        ask: "0.09 ETH",
        note: "Floor listing from an early campaign supporter.",
      },
      {
        collector: "Jules Morgan",
        pieces: "40 fragments",
        ask: "0.094 ETH",
        note: "Smaller collector lot split from a previous bundle buy.",
      },
    ],
  },
  {
    id: "kemi-token",
    creatorId: "kemi-hart",
    creator: "Kemi Hart",
    token: "KEMI",
    floor: "0.11 ETH",
    change: "+8.1%",
    supply: "2,050 fragments",
    liquidity: "31.9 ETH",
    holders: "266 holders",
    fragmentModel: "Fraction logic lets collectors list specific token slices instead of the entire position.",
    listings: [
      {
        collector: "Naomi West",
        pieces: "150 fragments",
        ask: "0.11 ETH",
        note: "Collector listing from toolkit release participation.",
      },
      {
        collector: "Theo B.",
        pieces: "70 fragments",
        ask: "0.116 ETH",
        note: "Premium ask from holder who wants to preserve the rest of the bag.",
      },
    ],
  },
];

export function getCreatorById(creatorId: string) {
  return creators.find((creator) => creator.id === creatorId);
}

export function getTokenById(tokenId: string) {
  return marketplaceCards.find((token) => token.id === tokenId);
}

export function getProductsByCreator(creatorId: string) {
  return featureCards.filter((product) => product.creatorId === creatorId);
}
