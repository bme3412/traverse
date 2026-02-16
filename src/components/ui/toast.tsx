"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, X } from "lucide-react";

export interface ToastProps {
  message: string;
  subtitle?: string;
  duration?: number;
  onClose: () => void;
  show: boolean;
}

export function Toast({ message, subtitle, duration = 4000, onClose, show }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show) {
      // Intentional synchronization: sync animation state with prop for slide-in effect
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsVisible(true);

      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 400); // Wait for fade-out animation
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [show, duration, onClose]);

  if (!show && !isVisible) return null;

  return (
    <div
      className={`fixed top-20 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md px-4 ${
        isVisible ? "animate-toast-slide" : "opacity-0"
      }`}
    >
      <div className="bg-card border-2 border-green-500 rounded-lg shadow-2xl overflow-hidden">
        {/* Main content */}
        <div className="flex items-start gap-3 p-4">
          {/* Success icon */}
          <div className="flex-shrink-0 mt-0.5">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          </div>

          {/* Text content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">{message}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={() => {
              setIsVisible(false);
              setTimeout(onClose, 400);
            }}
            className="flex-shrink-0 p-1 rounded hover:bg-secondary transition-colors"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-secondary">
          <div
            className="h-full bg-green-500 animate-progress-countdown"
            style={{ animationDuration: `${duration}ms` }}
          />
        </div>
      </div>
    </div>
  );
}
