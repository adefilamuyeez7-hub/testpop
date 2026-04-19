export type ProductCard = {
  id: string;
  title: string;
  creator: string;
  handle: string;
  type: "PDF" | "Image" | "Tool";
  price: string;
  accent: string;
  summary: string;
};

export const featureCards: ProductCard[] = [
  {
    id: "drop-1",
    title: "Build a drop page in 20 minutes",
    creator: "Nora Vale",
    handle: "@noravale",
    type: "PDF",
    price: "0.02 ETH",
    accent: "var(--peach)",
    summary: "A tactical creator guide with clean, in-app reading after collect.",
  },
  {
    id: "drop-2",
    title: "Brand kit for launch week",
    creator: "Mika Rose",
    handle: "@mikarose",
    type: "Image",
    price: "Free",
    accent: "var(--lavender)",
    summary: "Poster-ready visuals and launch assets designed for creator campaigns.",
  },
  {
    id: "drop-3",
    title: "Audience tracker toolkit",
    creator: "Kemi Hart",
    handle: "@kemihart",
    type: "Tool",
    price: "0.05 ETH",
    accent: "var(--mint)",
    summary: "A downloadable template stack for creator token and audience analytics.",
  },
];

export const marketplaceCards = [
  {
    id: "token-1",
    creator: "Nora Vale",
    token: "NORA",
    floor: "0.14 ETH",
    change: "+12.4%",
  },
  {
    id: "token-2",
    creator: "Mika Rose",
    token: "MIKA",
    floor: "0.09 ETH",
    change: "+4.8%",
  },
];
