import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2, AlertTriangle, Info, XCircle, X,
} from 'lucide-react';
import { useToastStore, type Toast as ToastType, type ToastTone } from '../store/toastStore';

const TONE_CONFIG: Record<
  ToastTone,
  {
    Icon: typeof CheckCircle2;
    iconBg: string;
    iconColor: string;
    accent: string;
    progress: string;
    label: string;
  }
> = {
  success: {
    Icon: CheckCircle2,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-500',
    accent: 'border-l-emerald-400',
    progress: 'from-emerald-400 to-teal-500',
    label: 'Éxito',
  },
  error: {
    Icon: XCircle,
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-500',
    accent: 'border-l-rose-400',
    progress: 'from-rose-400 to-red-500',
    label: 'Error',
  },
  warning: {
    Icon: AlertTriangle,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-500',
    accent: 'border-l-amber-400',
    progress: 'from-amber-400 to-orange-500',
    label: 'Atención',
  },
  info: {
    Icon: Info,
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-500',
    accent: 'border-l-indigo-400',
    progress: 'from-indigo-400 to-violet-500',
    label: 'Info',
  },
};

function ToastItem({ toast }: { toast: ToastType }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const config = TONE_CONFIG[toast.tone];
  const { Icon } = config;
  const [leaving, setLeaving] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const close = () => {
    setLeaving(true);
    timeoutRef.current = window.setTimeout(() => dismiss(toast.id), 220);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const duration = toast.duration ?? 0;

  return (
    <div
      role="status"
      aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
      className={`
        pointer-events-auto relative w-full sm:w-[380px] max-w-full overflow-hidden
        bg-white/95 backdrop-blur-xl ring-1 ring-slate-900/5
        rounded-2xl border-l-[3px] ${config.accent}
        shadow-[0_18px_50px_-12px_rgba(15,23,42,0.18),0_4px_12px_-2px_rgba(15,23,42,0.06)]
        ${leaving ? 'toast-leave' : 'toast-enter'}
      `}
    >
      <div className="flex items-start gap-3 p-3.5 pr-3">
        <div className={`flex-shrink-0 w-9 h-9 rounded-xl grid place-items-center ${config.iconBg}`}>
          <Icon size={17} className={config.iconColor} strokeWidth={2.4} />
        </div>

        <div className="flex-1 min-w-0 pt-0.5">
          <p className="font-display font-bold text-slate-900 text-sm leading-tight">
            {toast.title}
          </p>
          {toast.description && (
            <p className="text-[0.78rem] text-slate-500 mt-1 leading-relaxed">
              {toast.description}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={close}
          aria-label="Cerrar notificación"
          className="flex-shrink-0 w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 grid place-items-center transition-colors"
        >
          <X size={13} />
        </button>
      </div>

      {duration > 0 && (
        <div className="absolute left-0 right-0 bottom-0 h-[3px] bg-slate-100/60 overflow-hidden">
          <div
            className={`h-full origin-left bg-gradient-to-r ${config.progress}`}
            style={{ animation: `toastProgress ${duration}ms linear forwards` }}
          />
        </div>
      )}
    </div>
  );
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      aria-label="Notificaciones"
      className="fixed z-[120] top-[68px] lg:top-[80px] inset-x-0 sm:inset-x-auto sm:right-4 lg:right-6 pointer-events-none flex flex-col gap-2.5 px-3 sm:px-0 items-center sm:items-end"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>,
    document.body
  );
}
