import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { X } from 'lucide-react';

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
const TYPE_STYLES: Record<ToastType, string> = {
  success: 'border-l-[3px] border-l-[var(--accent)]',
  error:   'border-l-[3px] border-l-[var(--danger)]',
  warning: 'border-l-[3px] border-l-[var(--warning)]',
  info:    'border-l-[3px] border-l-[var(--accent)]',
};

const TYPE_DOT: Record<ToastType, string> = {
  success: 'bg-[var(--accent)]',
  error:   'bg-[var(--danger)]',
  warning: 'bg-[var(--warning)]',
  info:    'bg-[var(--accent)]',
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
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-[360px]">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`bg-white border border-[var(--line)] rounded ${TYPE_STYLES[t.type]} px-4 py-3 flex items-start gap-3`}
        >
          <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${TYPE_DOT[t.type]}`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--ink)]">{t.title}</p>
            {t.message && (
              <p className="text-xs text-[var(--slate)] mt-0.5">{t.message}</p>
            )}
          </div>
          <button
            onClick={() => onDismiss(t.id)}
            className="text-[var(--slate)] hover:text-[var(--ink)] flex-shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
