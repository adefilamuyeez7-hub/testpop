import { FC } from "react";
import { X, Play } from "lucide-react";

interface VideoViewerProps {
  src: string;
  poster?: string;
  onClose?: () => void;
}

export const VideoViewer: FC<VideoViewerProps> = ({ src, poster, onClose }) => {
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
      <video
        src={src}
        poster={poster}
        controls
        autoPlay
        className="max-w-full max-h-full w-full h-full object-contain"
      >
        Your browser does not support the video tag.
      </video>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40 hover:opacity-0 transition-opacity">
        <Play className="h-16 w-16 text-white fill-white" />
      </div>
    </div>
  );
};
