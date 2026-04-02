import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ipfsToHttp, uploadFileToPinata } from "@/lib/pinata";
import {
  type FeaturedCreatorSlide,
  loadFeaturedCreatorSlides,
  saveFeaturedCreatorSlides,
} from "@/lib/featuredCreators";
import { validateFileUpload, sanitizeString } from "@/lib/validation";

type EditableSlide = FeaturedCreatorSlide & {
  secondaryImage: string;
};

function createEmptySlide(index: number): EditableSlide {
  return {
    id: `featured-${index + 1}`,
    title: "",
    subtitle: "",
    artistName: "",
    artistTag: "",
    profilePath: "",
    primaryImage: "",
    secondaryImage: "",
  };
}

function normalizeSlidesForSave(slides: EditableSlide[]): FeaturedCreatorSlide[] {
  return slides
    .filter((slide) => slide.title.trim() && slide.artistName.trim() && slide.primaryImage.trim())
    .map((slide) => ({
      id: slide.id,
      title: sanitizeString(slide.title),
      subtitle: sanitizeString(slide.subtitle),
      artistName: sanitizeString(slide.artistName),
      artistTag: sanitizeString(slide.artistTag || ""),
      profilePath: sanitizeString(slide.profilePath || ""),
      primaryImage: slide.primaryImage.trim(),
      secondaryImage: slide.secondaryImage.trim(),
    }));
}

export function FeaturedCreatorsManager() {
  const [slides, setSlides] = useState<EditableSlide[]>([createEmptySlide(0), createEmptySlide(1)]);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const primaryInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const secondaryInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    const stored = loadFeaturedCreatorSlides();
    if (!stored.length) {
      return;
    }

    setSlides([
      { ...createEmptySlide(0), ...(stored[0] || {}) },
      { ...createEmptySlide(1), ...(stored[1] || {}) },
    ]);
  }, []);

  const updateSlide = (index: number, field: keyof EditableSlide, value: string) => {
    setSlides((current) =>
      current.map((slide, slideIndex) =>
        slideIndex === index ? { ...slide, [field]: value } : slide
      )
    );
  };

  const handleUpload = async (
    index: number,
    field: "primaryImage" | "secondaryImage",
    file?: File | null
  ) => {
    if (!file) {
      return;
    }

    const validation = validateFileUpload(file);
    if (!validation.valid) {
      toast.error(validation.error || "Invalid file");
      return;
    }

    const key = `${index}-${field}`;
    setUploadingKey(key);

    try {
      const cid = await uploadFileToPinata(file);
      const uri = `ipfs://${cid}`;
      updateSlide(index, field, ipfsToHttp(uri));
      toast.success(field === "primaryImage" ? "Primary image uploaded" : "Secondary image uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Image upload failed");
    } finally {
      setUploadingKey(null);
    }
  };

  const handleClear = (index: number) => {
    setSlides((current) =>
      current.map((slide, slideIndex) => (slideIndex === index ? createEmptySlide(index) : slide))
    );
  };

  const handleSave = () => {
    const normalized = normalizeSlidesForSave(slides);
    saveFeaturedCreatorSlides(normalized);
    toast.success(
      normalized.length > 0
        ? "Homepage featured creator carousel updated"
        : "Homepage featured creator carousel cleared"
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-sm font-semibold text-foreground">Featured Creator Carousel</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Configure up to two homepage feature slides. Each slide needs a title, creator name, and one main image.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {slides.map((slide, index) => (
          <div key={slide.id} className="rounded-2xl border border-border bg-card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Slide {index + 1}</p>
              <button
                type="button"
                onClick={() => handleClear(index)}
                className="inline-flex items-center gap-1 text-xs text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </button>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Headline</Label>
              <Input
                value={slide.title}
                onChange={(event) => updateSlide(index, "title", event.target.value)}
                placeholder="Featured Creator"
                className="h-9 rounded-lg text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Creator Name</Label>
              <Input
                value={slide.artistName}
                onChange={(event) => updateSlide(index, "artistName", event.target.value)}
                placeholder="Artist or collection name"
                className="h-9 rounded-lg text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Tag</Label>
                <Input
                  value={slide.artistTag || ""}
                  onChange={(event) => updateSlide(index, "artistTag", event.target.value)}
                  placeholder="Featured creator"
                  className="h-9 rounded-lg text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Profile Path</Label>
                <Input
                  value={slide.profilePath || ""}
                  onChange={(event) => updateSlide(index, "profilePath", event.target.value)}
                  placeholder="/artists/artist-id"
                  className="h-9 rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Description</Label>
              <Textarea
                value={slide.subtitle}
                onChange={(event) => updateSlide(index, "subtitle", event.target.value)}
                placeholder="Short curator note for the homepage"
                className="min-h-[84px] rounded-xl text-sm"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs">Primary Image</Label>
                <input
                  ref={(node) => {
                    primaryInputRefs.current[index] = node;
                  }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => void handleUpload(index, "primaryImage", event.target.files?.[0])}
                />
                <button
                  type="button"
                  onClick={() => primaryInputRefs.current[index]?.click()}
                  className="flex min-h-[152px] w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-secondary/40"
                >
                  {slide.primaryImage ? (
                    <img src={slide.primaryImage} alt={`Primary slide ${index + 1}`} className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      {uploadingKey === `${index}-primaryImage` ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <ImagePlus className="h-4 w-4" />
                          Upload main image
                        </>
                      )}
                    </span>
                  )}
                </button>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Secondary Image</Label>
                <input
                  ref={(node) => {
                    secondaryInputRefs.current[index] = node;
                  }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => void handleUpload(index, "secondaryImage", event.target.files?.[0])}
                />
                <button
                  type="button"
                  onClick={() => secondaryInputRefs.current[index]?.click()}
                  className="flex min-h-[152px] w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-secondary/40"
                >
                  {slide.secondaryImage ? (
                    <img src={slide.secondaryImage} alt={`Secondary slide ${index + 1}`} className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      {uploadingKey === `${index}-secondaryImage` ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <ImagePlus className="h-4 w-4" />
                          Upload optional image
                        </>
                      )}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} className="rounded-xl gradient-primary text-primary-foreground">
          <Save className="mr-2 h-4 w-4" />
          Save Featured Carousel
        </Button>
      </div>
    </div>
  );
}

export default FeaturedCreatorsManager;
