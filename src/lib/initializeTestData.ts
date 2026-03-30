/**
 * Initialize test data for demo purposes
 * This loads sample artists, drops, and products if none exist
 */

const STORAGE_KEYS = {
  artists: "popup_artist_profiles",
  drops: "popup_artist_drops",
  campaigns: "popup_artist_campaigns",
};

const TEST_ARTISTS = [
  {
    id: "artist-0x1A",
    wallet: "0x1A2B3C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9A0B",
    name: "Luna Echo",
    handle: "@lunaecho",
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop",
    banner:
      "https://images.unsplash.com/photo-1579783902614-e3fb5141b0cb?w=800&h=300&fit=crop",
    tag: "Digital Artist",
    bio: "Creating immersive digital experiences and NFT art",
    email: "luna@popup.art",
    twitter: "lunaecho",
    instagram: "lunaecho_art",
  },
  {
    id: "artist-0x2B",
    wallet: "0x2B3C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9A0B1C",
    name: "Pixel Dreams",
    handle: "@pixeldreams",
    avatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop",
    banner:
      "https://images.unsplash.com/photo-1617638924702-92521c7db620?w=800&h=300&fit=crop",
    tag: "3D Artist",
    bio: "Exploring the intersection of art and technology",
    email: "pixel@popup.art",
    twitter: "pixeldreams",
    instagram: "pixeldreams_studio",
  },
  {
    id: "artist-0x3C",
    wallet: "0x3C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9A0B1C2D",
    name: "Neon Canvas",
    handle: "@neoncanvas",
    avatar:
      "https://images.unsplash.com/photo-1507231230979-271cebf9f575?w=150&h=150&fit=crop",
    banner:
      "https://images.unsplash.com/photo-1620519486000-de8d9caf8f10?w=800&h=300&fit=crop",
    tag: "Painter",
    bio: "Traditional meets digital in vibrant expressions",
    email: "neon@popup.art",
    twitter: "neoncanvas",
    instagram: "neon_canvas_art",
  },
];

const TEST_DROPS = [
  {
    id: "drop-001",
    artistId: "artist-0x1A",
    title: "Ethereal Visions",
    artist: "Luna Echo",
    artistAvatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop",
    image:
      "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=500&h=500&fit=crop",
    metadataUri: "QmVirtualDrop001",
    priceEth: "0.5",
    endsIn: "3 days",
    type: "Drop",
    edition: "1/50",
    description: "Limited edition digital art piece featuring ethereal landscapes",
    bids: 12,
    poap: false,
    contractAddress: null,
    status: "live",
  },
  {
    id: "drop-002",
    artistId: "artist-0x2B",
    title: "Pixel Genesis",
    artist: "Pixel Dreams",
    artistAvatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop",
    image:
      "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=500&h=500&fit=crop",
    metadataUri: "QmVirtualDrop002",
    priceEth: "0.75",
    endsIn: "5 days",
    type: "Drop",
    edition: "1/100",
    description: "3D rendered abstract forms with dynamic lighting",
    bids: 8,
    poap: false,
    contractAddress: null,
    status: "live",
  },
  {
    id: "drop-003",
    artistId: "artist-0x3C",
    title: "Neon Futures",
    artist: "Neon Canvas",
    artistAvatar:
      "https://images.unsplash.com/photo-1507231230979-271cebf9f575?w=150&h=150&fit=crop",
    image:
      "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=500&h=500&fit=crop",
    metadataUri: "QmVirtualDrop003",
    priceEth: "0.35",
    endsIn: "1 day",
    type: "Drop",
    edition: "1/200",
    description: "Vibrant neon-inspired abstract compositions",
    bids: 23,
    poap: false,
    contractAddress: null,
    status: "live",
  },
];

const TEST_WHITELIST = [
  {
    id: "w-luna",
    wallet: "0x1A2B3C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9A0B",
    name: "Luna Echo",
    tag: "Digital Artist",
    status: "approved" as const,
    joinedAt: "Mar 2026",
  },
  {
    id: "w-pixel",
    wallet: "0x2B3C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9A0B1C",
    name: "Pixel Dreams",
    tag: "3D Artist",
    status: "approved" as const,
    joinedAt: "Mar 2026",
  },
  {
    id: "w-neon",
    wallet: "0x3C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9A0B1C2D",
    name: "Neon Canvas",
    tag: "Painter",
    status: "approved" as const,
    joinedAt: "Mar 2026",
  },
];

export function initializeTestData() {
  const storageKey = "popup_data_initialized_v2";
  const isInitialized = localStorage.getItem(storageKey);

  if (!isInitialized) {
    console.log("🚀 Initializing test data...");

    try {
      // Save test artists
      localStorage.setItem(STORAGE_KEYS.artists, JSON.stringify(TEST_ARTISTS));
      console.log("✅ Artists initialized:", TEST_ARTISTS.length);

      // Save test drops
      localStorage.setItem(STORAGE_KEYS.drops, JSON.stringify(TEST_DROPS));
      console.log("✅ Drops initialized:", TEST_DROPS.length);

      // Save whitelist
      localStorage.setItem(
        "popup_admin_whitelist",
        JSON.stringify(TEST_WHITELIST)
      );
      console.log("✅ Whitelist initialized:", TEST_WHITELIST.length);

      // Mark as initialized
      localStorage.setItem(storageKey, "true");
      console.log("✅ Test data initialization complete!");
    } catch (error) {
      console.error("❌ Error initializing test data:", error);
    }
  } else {
    console.log("✅ Test data already initialized");
  }
}
