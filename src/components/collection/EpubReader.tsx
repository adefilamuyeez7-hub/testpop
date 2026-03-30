import { FC, useState } from "react";
import { X, ChevronLeft, ChevronRight, Menu } from "lucide-react";

interface EpubReaderProps {
  src: string;
  title?: string;
  onClose?: () => void;
}

export const EpubReader: FC<EpubReaderProps> = ({ src, title, onClose }) => {
  const [showToc, setShowToc] = useState(false);

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
                <div className="p-2 hover:bg-orange-50 rounded cursor-pointer">Chapter 1</div>
                <div className="p-2 hover:bg-orange-50 rounded cursor-pointer">Chapter 2</div>
                <div className="p-2 hover:bg-orange-50 rounded cursor-pointer">Chapter 3</div>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 flex items-center justify-center overflow-auto">
          <div className="max-w-2xl w-full h-full flex items-center justify-center">
            <div className="p-8 text-center text-orange-700">
              <p className="text-sm mb-4">
                EPUB Reader is loading. For full functionality, use a dedicated EPUB reader application.
              </p>
              <p className="text-xs text-orange-600">
                File: {src}
              </p>
              <button className="mt-6 px-4 py-2 bg-orange-200 hover:bg-orange-300 text-orange-900 rounded-lg transition-colors text-sm">
                Open in External Reader
              </button>
            </div>
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
          <button className="p-2 hover:bg-orange-100 rounded-lg transition-colors">
            <ChevronLeft className="h-5 w-5 text-orange-800" />
          </button>
          <span className="text-sm text-orange-700 min-w-24 text-center">
            Page 1
          </span>
          <button className="p-2 hover:bg-orange-100 rounded-lg transition-colors">
            <ChevronRight className="h-5 w-5 text-orange-800" />
          </button>
        </div>

        <div></div>
      </div>
    </div>
  );
};
