import { FC, useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface PdfReaderProps {
  src: string;
  title?: string;
  onClose?: () => void;
}

export const PdfReader: FC<PdfReaderProps> = ({ src, title, onClose }) => {
  const [pageNumber, setPageNumber] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load PDF metadata to get page count
    fetch(src)
      .then(res => res.blob())
      .then(blob => {
        // For now, we'll show the PDF in an iframe
        // Full PDF.js integration would require additional setup
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Failed to load PDF:", err);
        setIsLoading(false);
      });
  }, [src]);

  return (
    <div className="relative w-full h-full flex flex-col bg-gray-900 rounded-xl overflow-hidden">
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/40 rounded-full transition-colors z-10"
        >
          <X className="h-5 w-5 text-white" />
        </button>
      )}

      {title && (
        <div className="bg-gray-800 px-6 py-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
      )}

      <div className="flex-1 flex items-center justify-center overflow-auto">
        {isLoading ? (
          <div className="text-center text-gray-400">
            <div className="h-8 w-8 border-4 border-gray-600 border-t-white rounded-full animate-spin mx-auto mb-2"></div>
            Loading PDF...
          </div>
        ) : (
          <iframe
            src={src}
            className="w-full h-full border-0"
            title="PDF Viewer"
          />
        )}
      </div>

      <div className="bg-gray-800 px-6 py-4 border-t border-gray-700 flex items-center justify-center gap-4">
        <button className="p-2 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50">
          <ChevronLeft className="h-5 w-5 text-white" />
        </button>
        <span className="text-sm text-gray-400 min-w-24 text-center">
          Page {pageNumber} of {totalPages}
        </span>
        <button className="p-2 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50">
          <ChevronRight className="h-5 w-5 text-white" />
        </button>
      </div>
    </div>
  );
};
