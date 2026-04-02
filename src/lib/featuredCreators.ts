export type FeaturedCreatorSlide = {
  id: string;
  title: string;
  subtitle: string;
  artistName: string;
  artistTag?: string;
  profilePath?: string;
  primaryImage: string;
  secondaryImage?: string;
};

const STORAGE_KEY = "popup-featured-creators";
const UPDATE_EVENT = "popup-featured-creators-updated";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getFeaturedCreatorsUpdateEventName() {
  return UPDATE_EVENT;
}

export function loadFeaturedCreatorSlides(): FeaturedCreatorSlide[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((slide): slide is FeaturedCreatorSlide => {
      return (
        slide &&
        typeof slide.id === "string" &&
        typeof slide.title === "string" &&
        typeof slide.subtitle === "string" &&
        typeof slide.artistName === "string" &&
        typeof slide.primaryImage === "string"
      );
    });
  } catch {
    return [];
  }
}

export function saveFeaturedCreatorSlides(slides: FeaturedCreatorSlide[]) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slides));
  window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
}
