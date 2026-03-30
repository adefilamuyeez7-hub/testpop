import { FC } from "react";
import { X, Music } from "lucide-react";

interface AudioPlayerProps {
  src: string;
  title?: string;
  onClose?: () => void;
}

export const AudioPlayer: FC<AudioPlayerProps> = ({ src, title, onClose }) => {
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-purple-900 to-black rounded-xl overflow-hidden p-6">
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/40 rounded-full transition-colors z-10"
        >
          <X className="h-5 w-5 text-white" />
        </button>
      )}
      <Music className="h-16 w-16 text-purple-300 mb-4" />
      {title && (
        <h3 className="text-lg font-semibold text-white text-center mb-6">{title}</h3>
      )}
      <audio
        src={src}
        controls
        autoPlay
        className="w-full max-w-sm"
      >
        Your browser does not support the audio element.
      </audio>
    </div>
  );
};
