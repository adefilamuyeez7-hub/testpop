import { FC, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, X } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Configure PDF.js worker using the installed pdfjs-dist package.
// This avoids CDN version mismatches and the fake worker warning.
if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  console.debug("[PDF] Worker configured:", {
    version: pdfjs.version,
    workerUrl: workerSrc,
  });
}

interface PdfReaderProps {
  src: string;
  title?: string;
  onClose?: () => void;
}

export const PdfReader: FC<PdfReaderProps> = ({ src, title, onClose }) => {
  const [pageNumber, setPageNumber] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [pdfSource, setPdfSource] = useState<Uint8Array | string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const resolvedSourceUrl = (() => {
    const trimmed = src.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("blob:") || trimmed.startsWith("data:") || trimmed.startsWith("/")) {
      return trimmed;
    }
    if (trimmed.startsWith("ipfs://")) {
      return `/api/media/proxy?url=${encodeURIComponent(trimmed)}`;
    }
    if (/^https?:\/\/[^/]+\/ipfs\/.+/i.test(trimmed)) {
      return `/api/media/proxy?url=${encodeURIComponent(trimmed)}`;
    }
    return trimmed;
  })();

  useEffect(() => {
    setPageNumber(1);
    setTotalPages(1);
    setIsLoading(true);
    setError(null);
    setPdfSource(null);
  }, [src]);

  useEffect(() => {
    let cancelled = false;
    const abortController = new AbortController();

    const loadPdfSource = async () => {
      if (!resolvedSourceUrl) {
        setError("This PDF source could not be reached.");
        setIsLoading(false);
        return;
      }

      try {
        // For PDFs, always use the proxy URL directly to avoid CORS issues
        setPdfSource(resolvedSourceUrl);
      } catch (error) {
        console.warn("Failed to load PDF:", error);
        setError("This PDF could not be loaded.");
        setIsLoading(false);
      }
    };

    void loadPdfSource();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [resolvedSourceUrl]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => setContainerWidth(container.clientWidth);
    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const canGoPrev = pageNumber > 1;
  const canGoNext = pageNumber < totalPages;
  const pageWidth = Math.max(Math.min(containerWidth - 32, 960), 280);

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[#0b1220] text-white">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#101a2f] px-4 py-3 sm:px-6">
        <div className="min-w-0">
          {title && <h3 className="truncate text-base font-semibold sm:text-lg">{title}</h3>}
          <p className="text-xs text-white/60">
            {isLoading ? "Opening document..." : `Page ${pageNumber} of ${totalPages}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white/85 transition-colors hover:bg-white/10"
          >
            <ExternalLink className="h-4 w-4" />
            Open Source
          </a>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-full border border-white/15 bg-white/5 p-2 transition-colors hover:bg-white/10"
              aria-label="Close PDF reader"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      <div ref={containerRef} className="relative min-h-0 flex-1 overflow-auto bg-[#111827] px-4 py-4 sm:px-8">
        <div className="mx-auto w-fit rounded-[1.5rem] bg-white p-3 shadow-[0_30px_80px_rgba(15,23,42,0.45)]">
          {!error && pdfSource && (
            <Document
              file={pdfSource}
              loading=""
              onLoadSuccess={({ numPages }) => {
                console.debug("[PDF] Document loaded successfully:", { numPages, src });
                setTotalPages(numPages);
                setIsLoading(false);
                setError(null);
                setPageNumber((current) => Math.min(current, numPages));
              }}
              onLoadError={(loadError) => {
                // FIXED #6: Better error logging
                const errorDetails = {
                  type: "LoadError",
                  message: loadError?.message || String(loadError),
                  src: src,
                  resolvedSourceUrl: resolvedSourceUrl,
                  timestamp: new Date().toISOString(),
                };
                console.error("[PDF] Load failed:", errorDetails);
                setError("This PDF could not be opened in the in-app reader.");
                setIsLoading(false);
              }}
              onSourceError={(sourceError) => {
                // FIXED #6: Better error logging
                const errorDetails = {
                  type: "SourceError",
                  message: sourceError?.message || String(sourceError),
                  src: src,
                  resolvedSourceUrl: resolvedSourceUrl,
                  timestamp: new Date().toISOString(),
                };
                console.error("[PDF] Source error:", errorDetails);
                setError("This PDF source could not be reached.");
                setIsLoading(false);
              }}
            >
              <Page
                pageNumber={pageNumber}
                width={pageWidth}
                renderAnnotationLayer
                renderTextLayer
                loading=""
                onRenderSuccess={() => {
                  console.debug("[PDF] Page rendered successfully:", { pageNumber });
                  setIsLoading(false);
                }}
                onRenderError={(renderError) => {
                  // FIXED #6: Better error logging
                  const errorDetails = {
                    type: "RenderError",
                    message: renderError?.message || String(renderError),
                    pageNumber,
                    src,
                    timestamp: new Date().toISOString(),
                  };
                  console.error("[PDF] Render failed:", errorDetails);
                  setError("This PDF loaded but could not be rendered on this device.");
                  setIsLoading(false);
                }}
              />
            </Document>
          )}
        </div>

        {isLoading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0b1220]/78">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-[#101a2f] px-5 py-3 text-sm text-white/80 shadow-lg">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading PDF...
            </div>
          </div>
        )}

        {error && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0b1220]/82 p-6">
            <div className="max-w-md rounded-[1.5rem] border border-white/10 bg-[#101a2f] p-6 text-center shadow-xl">
              <p className="text-sm text-white/80">{error}</p>
              <a
                href={src}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-200"
              >
                <ExternalLink className="h-4 w-4" />
                Open PDF in Browser
              </a>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-4 border-t border-white/10 bg-[#101a2f] px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => canGoPrev && setPageNumber((current) => Math.max(1, current - 1))}
          disabled={!canGoPrev || isLoading}
          className="rounded-full border border-white/15 bg-white/5 p-2 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="min-w-28 text-center text-sm text-white/70">
          Page {pageNumber} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => canGoNext && setPageNumber((current) => Math.min(totalPages, current + 1))}
          disabled={!canGoNext || isLoading}
          className="rounded-full border border-white/15 bg-white/5 p-2 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};
