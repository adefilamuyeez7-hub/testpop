import type { Book, NavItem, Rendition } from "epubjs";
import ePub from "epubjs";
import { FC, useEffect, useMemo, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, Menu, ExternalLink, Loader2, Type } from "lucide-react";

interface EpubReaderProps {
  src: string;
  title?: string;
  onClose?: () => void;
}

const FONT_SCALE_STEPS = [90, 100, 112, 126, 142];

export const EpubReader: FC<EpubReaderProps> = ({ src, title, onClose }) => {
  const [showToc, setShowToc] = useState(false);
  const [toc, setToc] = useState<NavItem[]>([]);
  const [currentLocation, setCurrentLocation] = useState<string | null>(null);
  const [currentLabel, setCurrentLabel] = useState("Opening book...");
  const [fontScaleIndex, setFontScaleIndex] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const bookRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);

  const storageKey = useMemo(() => `popup:ebook:${src}`, [src]);

  useEffect(() => {
    const container = viewerRef.current;
    if (!container) {
      return;
    }

    let cancelled = false;
    const abortController = new AbortController();
    let book: Book | null = null;
    let rendition: Rendition | null = null;

    setIsLoading(true);
    setError(null);

    const openBook = async () => {
      const createReader = async (source: string | ArrayBuffer) => {
        book = ePub(source);
        rendition = book.renderTo(container, {
          width: "100%",
          height: "100%",
          flow: "paginated",
          manager: "default",
          spread: "none",
          allowScriptedContent: false,
        });

        bookRef.current = book;
        renditionRef.current = rendition;
        rendition.on("relocated", handleRelocated);
        rendition.on("rendered", handleRendered);
        rendition.on("displayError", handleRenderError);

        rendition.themes.default({
          body: {
            "background-color": "#fffdf8",
            color: "#18181b",
            "line-height": "1.75",
            padding: "22px 18px",
          },
          p: {
            "margin-bottom": "1.1em",
          },
          "h1, h2, h3, h4, h5, h6": {
            color: "#111827",
          },
          img: {
            "max-width": "100%",
            height: "auto",
          },
        });

        rendition.themes.fontSize(`${FONT_SCALE_STEPS[fontScaleIndex]}%`);

        const navigation = await book.loaded.navigation;
        if (!cancelled) {
          setToc(navigation.toc || []);
        }

        const savedLocation = window.localStorage.getItem(storageKey) || undefined;
        await rendition.display(savedLocation);
      };

      try {
        try {
          const response = await fetch(src, { signal: abortController.signal });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const binary = await response.arrayBuffer();
          if (cancelled) {
            return;
          }

          await createReader(binary);
        } catch (binaryError) {
          if (abortController.signal.aborted || cancelled) {
            return;
          }

          console.warn("Falling back to direct EPUB URL loading:", binaryError);
          await createReader(src);
        }
      } catch (loadError) {
        console.error("Failed to render EPUB:", loadError);
        if (!cancelled) {
          setError("This EPUB could not be opened in the in-app reader.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    const handleRelocated = (location: { start?: { cfi?: string; index?: number; href?: string; display?: { page?: number; total?: number } } }) => {
      const cfi = location.start?.cfi ?? null;
      const href = location.start?.href ?? null;
      const page = location.start?.display?.page;
      const total = location.start?.display?.total;
      const label = page && total ? `Page ${page} of ${total}` : href || "Reading";

      setCurrentLocation(cfi);
      setCurrentLabel(label);

      if (cfi) {
        window.localStorage.setItem(storageKey, cfi);
      }
    };

    const handleRenderError = (renderError: unknown) => {
      console.error("EPUB rendition error:", renderError);
      setError("This EPUB could not be rendered in the reader.");
      setIsLoading(false);
    };
    const handleRendered = () => {
      setIsLoading(false);
    };

    openBook();

    return () => {
      cancelled = true;
      abortController.abort();
      rendition?.off("relocated", handleRelocated);
      rendition?.off("displayError", handleRenderError);
      rendition?.destroy();
      book?.destroy();
      renditionRef.current = null;
      bookRef.current = null;
    };
  }, [src, storageKey]);

  useEffect(() => {
    renditionRef.current?.themes.fontSize(`${FONT_SCALE_STEPS[fontScaleIndex]}%`);
  }, [fontScaleIndex]);

  const goPrev = () => {
    void renditionRef.current?.prev();
  };

  const goNext = () => {
    void renditionRef.current?.next();
  };

  const handleChapterSelect = (href?: string | null) => {
    if (!href) {
      return;
    }

    setShowToc(false);
    setIsLoading(true);
    void renditionRef.current?.display(href);
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-gradient-to-b from-amber-50 to-orange-50 rounded-xl overflow-hidden">
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-white/40 hover:bg-white/60 rounded-full transition-colors z-20"
        >
          <X className="h-5 w-5 text-orange-800" />
        </button>
      )}

      {title && (
        <div className="bg-white/80 backdrop-blur px-6 py-4 border-b border-orange-200">
          <h3 className="text-lg font-semibold text-orange-900">{title}</h3>
        </div>
      )}

      <div className="flex-1 flex relative overflow-hidden">
        {showToc && (
          <div className="w-64 bg-white border-r border-orange-200 overflow-y-auto">
            <div className="p-4">
              <h4 className="font-semibold text-orange-900 mb-4">Table of Contents</h4>
              <div className="space-y-2 text-sm text-orange-800">
                {toc.length > 0 ? (
                  toc.map((chapter) => (
                    <button
                      key={chapter.id}
                      type="button"
                      onClick={() => handleChapterSelect(chapter.href)}
                      className="block w-full rounded p-2 text-left transition-colors hover:bg-orange-50"
                    >
                      {chapter.label}
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-orange-700/80">No chapter list was found in this EPUB.</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 flex items-center justify-center overflow-auto">
          <div className="relative h-full w-full">
            <div ref={viewerRef} className="h-full w-full bg-[#fffdf8]" />

            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#fffdf8]/90">
                <div className="flex items-center gap-2 text-sm text-orange-800">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Opening EPUB...
                </div>
              </div>
            )}

            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#fffdf8] p-6">
                <div className="max-w-md rounded-2xl border border-orange-200 bg-white p-6 text-center text-orange-800 shadow-sm">
                  <p className="text-sm">{error}</p>
                  <a
                    href={src}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-orange-200 px-4 py-2 text-sm font-medium text-orange-900 transition-colors hover:bg-orange-300"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open EPUB Source
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur px-6 py-4 border-t border-orange-200 flex items-center justify-between">
        <button
          onClick={() => setShowToc(!showToc)}
          className="p-2 hover:bg-orange-100 rounded-lg transition-colors"
        >
          <Menu className="h-5 w-5 text-orange-800" />
        </button>

        <div className="flex items-center gap-4">
          <button type="button" onClick={goPrev} className="p-2 hover:bg-orange-100 rounded-lg transition-colors">
            <ChevronLeft className="h-5 w-5 text-orange-800" />
          </button>
          <span className="text-sm text-orange-700 min-w-24 text-center">
            {currentLabel}
          </span>
          <button type="button" onClick={goNext} className="p-2 hover:bg-orange-100 rounded-lg transition-colors">
            <ChevronRight className="h-5 w-5 text-orange-800" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Type className="h-4 w-4 text-orange-700" />
          <button
            type="button"
            onClick={() => setFontScaleIndex((current) => Math.max(0, current - 1))}
            className="rounded-lg px-2 py-1 text-sm text-orange-800 transition-colors hover:bg-orange-100"
          >
            A-
          </button>
          <button
            type="button"
            onClick={() => setFontScaleIndex((current) => Math.min(FONT_SCALE_STEPS.length - 1, current + 1))}
            className="rounded-lg px-2 py-1 text-sm text-orange-800 transition-colors hover:bg-orange-100"
          >
            A+
          </button>
        </div>
      </div>
    </div>
  );
};
