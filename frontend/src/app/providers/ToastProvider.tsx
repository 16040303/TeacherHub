import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastInput {
  message: string;
  type?: ToastType;
  durationMs?: number;
}

interface ToastItem extends Required<ToastInput> {
  id: string;
}

interface ToastContextValue {
  showToast: (input: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const typeClasses: Record<ToastType, string> = {
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  error: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
  info: 'border-blue-500/40 bg-blue-500/10 text-blue-200',
};

const typeIcon: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 size={18} />,
  error: <AlertCircle size={18} />,
  info: <Info size={18} />,
};

interface ToastProviderProps {
  children: React.ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (input: ToastInput): void => {
      if (!input.message.trim()) {
        return;
      }

      const toast: ToastItem = {
        id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        message: input.message.trim(),
        type: input.type ?? 'info',
        durationMs: input.durationMs ?? 2600,
      };

      setToasts((current) => [...current, toast]);
      window.setTimeout(() => removeToast(toast.id), toast.durationMs);
    },
    [removeToast],
  );

  const value = useMemo<ToastContextValue>(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`animate-in slide-in-from-top-4 fade-in rounded-xl border p-3 shadow-xl backdrop-blur ${typeClasses[toast.type]}`}
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5">{typeIcon[toast.type]}</span>
              <p className="flex-1 text-sm font-semibold leading-relaxed">{toast.message}</p>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="rounded-md p-1 text-current/80 transition hover:bg-black/10"
                aria-label="Close notification"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }

  return context;
};
