import { FC, useState } from "react";
import { Download, Lock, CheckCircle, AlertCircle, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DownloadPanelProps {
  fileName?: string;
  fileSize?: string;
  fileType?: string;
  downloadUrl?: string;
  isGated?: boolean;
  isOwned?: boolean;
  isSubscribed?: boolean;
  onDownload?: () => void;
  accessNote?: string;
}

export const DownloadPanel: FC<DownloadPanelProps> = ({
  fileName = "Artwork",
  fileSize,
  fileType,
  downloadUrl,
  isGated = false,
  isOwned = false,
  isSubscribed = false,
  onDownload,
  accessNote,
}) => {
  const [copied, setCopied] = useState(false);

  const canAccess = !isGated || isOwned || isSubscribed;
  const isCopied = copied;

  const handleCopy = () => {
    if (downloadUrl) {
      navigator.clipboard.writeText(downloadUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl border border-slate-700 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-white text-lg">{fileName}</h3>
          <p className="text-sm text-slate-400 mt-1">
            {fileType && <span>{fileType.toUpperCase()}</span>}
            {fileSize && <span> • {fileSize}</span>}
          </p>
        </div>
        {canAccess && (
          <CheckCircle className="h-6 w-6 text-green-400" />
        )}
        {isGated && !canAccess && (
          <Lock className="h-6 w-6 text-amber-400" />
        )}
      </div>

      {accessNote && (
        <div className="mb-4 p-3 bg-slate-700/50 rounded-lg border border-slate-600">
          <p className="text-sm text-slate-300">{accessNote}</p>
        </div>
      )}

      {isGated && !canAccess && (
        <div className="mb-4 p-3 flex items-start gap-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
          <AlertCircle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-100">
            This content is gated. Subscribe to the artist or own a copy to unlock.
          </p>
        </div>
      )}

      <div className="flex gap-2">
        {canAccess && downloadUrl && (
          <>
            <Button
              onClick={onDownload}
              className="flex-1 gap-2 bg-gradient-primary hover:opacity-90"
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopy}
              title="Copy download link"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </>
        )}
        {!canAccess && (
          <Button
            disabled
            className="flex-1 gap-2 opacity-50 cursor-not-allowed"
          >
            <Lock className="h-4 w-4" />
            Locked
          </Button>
        )}
      </div>

      {isCopied && (
        <p className="text-sm text-green-400 mt-2">Link copied to clipboard!</p>
      )}
    </div>
  );
};
