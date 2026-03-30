import { FC } from "react";
import { X } from "lucide-react";

interface ImageViewerProps {
  src: string;
  alt: string;
  onClose?: () => void;
}

export const ImageViewer: FC<ImageViewerProps> = ({ src, alt, onClose }) => {
  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black/90 rounded-xl overflow-hidden">
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/40 rounded-full transition-colors z-10"
        >
          <X className="h-5 w-5 text-white" />
        </button>
      )}
      <img
        src={src}
        alt={alt}
        className="max-w-full max-h-full object-contain"
      />
    </div>
  );
};
