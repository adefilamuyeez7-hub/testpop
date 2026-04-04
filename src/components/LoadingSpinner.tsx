import { Loader2 } from 'lucide-react';

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  fullHeight?: boolean;
}

export const LoadingSpinner = ({
  size = 'md',
  text,
  fullHeight = true
}: LoadingSpinnerProps) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  };

  const containerClass = fullHeight ? 'min-h-[40vh]' : '';

  return (
    <div className={`flex items-center justify-center gap-3 ${containerClass}`}>
      <Loader2 className={`${sizeClasses[size]} animate-spin text-muted-foreground`} />
      {text && <span className="text-sm text-muted-foreground">{text}</span>}
    </div>
  );
};
