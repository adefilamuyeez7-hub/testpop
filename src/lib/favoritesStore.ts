export interface Favorites {
  favoriteArtists: string[];
  favoritePOAPs: number[];
}

const favoritesByWallet = new Map<string, Favorites>();

function normalizeWallet(userAddress?: string) {
  return userAddress?.toLowerCase().trim() ?? "";
}

function getDefaultFavorites(): Favorites {
  return { favoriteArtists: [], favoritePOAPs: [] };
}

export function getFavorites(userAddress?: string): Favorites {
  const wallet = normalizeWallet(userAddress);
  if (!wallet) return getDefaultFavorites();
  return favoritesByWallet.get(wallet) ?? getDefaultFavorites();
}

export function toggleArtistFavorite(userAddress: string, artistAddress: string): boolean {
  const wallet = normalizeWallet(userAddress);
  if (!wallet) return false;

  const favorites = getFavorites(userAddress);
  const normalizedArtist = artistAddress.toLowerCase();
  const index = favorites.favoriteArtists.findIndex(
    (artist) => artist.toLowerCase() === normalizedArtist
  );

  if (index >= 0) {
    favorites.favoriteArtists.splice(index, 1);
  } else {
    favorites.favoriteArtists.push(normalizedArtist);
  }

  favoritesByWallet.set(wallet, {
    favoriteArtists: [...favorites.favoriteArtists],
    favoritePOAPs: [...favorites.favoritePOAPs],
  });

  return index < 0;
}

export function isArtistFavorited(userAddress: string, artistAddress: string): boolean {
  const favorites = getFavorites(userAddress);
  return favorites.favoriteArtists.some(
    (artist) => artist.toLowerCase() === artistAddress.toLowerCase()
  );
}

export function togglePOAPFavorite(userAddress: string, campaignId: number): boolean {
  const wallet = normalizeWallet(userAddress);
  if (!wallet) return false;

  const favorites = getFavorites(userAddress);
  const index = favorites.favoritePOAPs.indexOf(campaignId);

  if (index >= 0) {
    favorites.favoritePOAPs.splice(index, 1);
  } else {
    favorites.favoritePOAPs.push(campaignId);
  }

  favoritesByWallet.set(wallet, {
    favoriteArtists: [...favorites.favoriteArtists],
    favoritePOAPs: [...favorites.favoritePOAPs],
  });

  return index < 0;
}

export function isPOAPFavorited(userAddress: string, campaignId: number): boolean {
  const favorites = getFavorites(userAddress);
  return favorites.favoritePOAPs.includes(campaignId);
}
