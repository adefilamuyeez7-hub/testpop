import { FC, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, X } from "lucide-react";
import { GlobalWorkerOptions, getDocument, type PDFDocumentLoadingTask, type PDFDocumentProxy, type RenderTask } from "pdfjs-dist";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

interface PdfReaderProps {
  src: string;
  title?: string;
  onClose?: () => void;
}

export const PdfReader: FC<PdfReaderProps> = ({ src, title, onClose }) => {
  const [pageNumber, setPageNumber] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfDocumentRef = useRef<PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | null = null;
    const abortController = new AbortController();

    setIsLoading(true);
    setIsRendering(false);
    setError(null);
    setPageNumber(1);
    setTotalPages(1);

    const loadPdf = async () => {
      try {
        try {
          const response = await fetch(src, { signal: abortController.signal });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const bytes = new Uint8Array(await response.arrayBuffer());
          if (cancelled) {
            return;
          }

          loadingTask = getDocument({ data: bytes });
        } catch (fetchError) {
          if (abortController.signal.aborted || cancelled) {
            return;
          }

          console.warn("Falling back to direct PDF URL loading:", fetchError);
          loadingTask = getDocument(src);
        }

        const pdf = await loadingTask.promise;
        if (cancelled) {
          void pdf.destroy();
          return;
        }

        pdfDocumentRef.current = pdf;
        setTotalPages(pdf.numPages);
      } catch (err) {
        console.error("Failed to load PDF:", err);
        if (!cancelled) {
          setError("This PDF could not be opened in the in-app reader.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadPdf();

    return () => {
      cancelled = true;
      abortController.abort();
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
      void loadingTask?.destroy();
      void pdfDocumentRef.current?.destroy();
      pdfDocumentRef.current = null;
    };
  }, [src]);

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

  useEffect(() => {
    const pdf = pdfDocumentRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!pdf || !canvas || !containerWidth || !container) {
      return;
    }

    let cancelled = false;

    const renderPage = async () => {
      try {
        setIsRendering(true);
        setError(null);

        renderTaskRef.current?.cancel();
        renderTaskRef.current = null;

        const page = await pdf.getPage(pageNumber);
        const unscaledViewport = page.getViewport({ scale: 1 });
        const availableWidth = Math.max(containerWidth - 32, 280);
        const fitScale = availableWidth / unscaledViewport.width;
        const cssViewport = page.getViewport({ scale: fitScale });
        const deviceScale = typeof window !== "undefined" ? Math.max(window.devicePixelRatio || 1, 1) : 1;
        const renderViewport = page.getViewport({ scale: fitScale * deviceScale });
        const context = canvas.getContext("2d", { alpha: false });

        if (!context) {
          throw new Error("Canvas context is not available");
        }

        canvas.width = Math.ceil(renderViewport.width);
        canvas.height = Math.ceil(renderViewport.height);
        canvas.style.width = `${Math.ceil(cssViewport.width)}px`;
        canvas.style.height = `${Math.ceil(cssViewport.height)}px`;

        const renderTask = page.render({
          canvasContext: context,
          viewport: renderViewport,
        });
        renderTaskRef.current = renderTask;
        await renderTask.promise;
      } catch (err) {
        if ((err as { name?: string })?.name === "RenderingCancelledException" || cancelled) {
          return;
        }
        console.error("Failed to render PDF page:", err);
        setError("This PDF loaded but could not be rendered on this device.");
      } finally {
        if (!cancelled) {
          setIsRendering(false);
        }
      }
    };

    void renderPage();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
    };
  }, [containerWidth, pageNumber, totalPages]);

  const canGoPrev = pageNumber > 1;
  const canGoNext = pageNumber < totalPages;

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
          <canvas ref={canvasRef} className="block max-w-full rounded-[1rem]" />
        </div>

        {(isLoading || isRendering) && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0b1220]/78">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-[#101a2f] px-5 py-3 text-sm text-white/80 shadow-lg">
              <Loader2 className="h-4 w-4 animate-spin" />
              {isLoading ? "Loading PDF..." : "Rendering page..."}
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
          disabled={!canGoPrev || isLoading || isRendering}
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
          disabled={!canGoNext || isLoading || isRendering}
          className="rounded-full border border-white/15 bg-white/5 p-2 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};
