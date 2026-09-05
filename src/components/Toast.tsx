import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { X, CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';

// --- Types ---
type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (type: ToastType, title: string, message?: string) => void;
  removeToast: (id: string) => void;
}

// --- Context ---
const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

// --- Provider ---
let toastCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastType, title: string, message?: string) => {
      const id = `toast-${++toastCounter}`;
      setToasts((prev) => [...prev, { id, type, title, message }]);
      setTimeout(() => removeToast(id), 4000);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

// --- Container ---
const TYPE_BAR: Record<ToastType, string> = {
  success: 'bg-[var(--success)]',
  error:   'bg-[var(--danger)]',
  warning: 'bg-[var(--warning)]',
  info:    'bg-[var(--accent)]',
};

const TYPE_TILE: Record<ToastType, string> = {
  success: 'tile-green',
  error:   'tile-pink',
  warning: 'tile-amber',
  info:    'tile-blue',
};

const TYPE_ICON: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error:   XCircle,
  warning: AlertTriangle,
  info:    Info,
};

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 w-[380px]">
      {toasts.map((t) => {
        const Icon = TYPE_ICON[t.type];
        return (
          <div
            key={t.id}
            className="animate-rise relative bg-white border border-[var(--line)] rounded-[var(--r-lg)] shadow-[var(--shadow-lg)] pl-5 pr-4 py-4 flex items-start gap-3 overflow-hidden"
          >
            <span
              className={`absolute left-0 top-0 bottom-0 w-1 ${TYPE_BAR[t.type]}`}
            />
            <span className={`icon-tile w-9 h-9 ${TYPE_TILE[t.type]}`}>
              <Icon size={18} />
            </span>
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-sm font-semibold text-[var(--ink)]">{t.title}</p>
              {t.message && (
                <p className="text-xs text-[var(--slate)] mt-1 leading-relaxed">
                  {t.message}
                </p>
              )}
            </div>
            <button
              onClick={() => onDismiss(t.id)}
              className="text-[var(--muted)] hover:text-[var(--ink)] flex-shrink-0 p-1 -m-1 rounded-[var(--r-sm)] hover:bg-[var(--canvas)] transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
