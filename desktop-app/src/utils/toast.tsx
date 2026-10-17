import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

type ToastListener = (items: ToastItem[]) => void;

let toasts: ToastItem[] = [];
let listeners: ToastListener[] = [];

export const toast = {
  show(message: string, type: ToastType = 'info', durationMs: number = 3500) {
    if (!message) return;
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newItem: ToastItem = { id, type, message };
    toasts = [newItem, ...toasts].slice(0, 4); // Max 4 toasts at a time
    listeners.forEach(fn => fn(toasts));

    setTimeout(() => {
      toasts = toasts.filter(t => t.id !== id);
      listeners.forEach(fn => fn(toasts));
    }, durationMs);
  },
  success(message: string, durationMs?: number) {
    this.show(message, 'success', durationMs);
  },
  error(message: string, durationMs?: number) {
    this.show(message, 'error', durationMs || 4500);
  },
  warning(message: string, durationMs?: number) {
    this.show(message, 'warning', durationMs);
  },
  info(message: string, durationMs?: number) {
    this.show(message, 'info', durationMs);
  },
  dismiss(id: string) {
    toasts = toasts.filter(t => t.id !== id);
    listeners.forEach(fn => fn(toasts));
  },
  subscribe(fn: ToastListener) {
    listeners.push(fn);
    fn(toasts);
    return () => {
      listeners = listeners.filter(l => l !== fn);
    };
  }
};

export const ToastContainer: React.FC = () => {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    return toast.subscribe(setItems);
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 w-full max-w-sm px-4 pointer-events-none">
      {items.map(item => (
        <div
          key={item.id}
          className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-2xl shadow-xl border w-full animate-fadeIn transition-all text-xs font-bold ${
            item.type === 'success'
              ? 'bg-emerald-900/90 text-white border-emerald-700/80 backdrop-blur-md'
              : item.type === 'error'
              ? 'bg-rose-900/95 text-white border-rose-700/80 backdrop-blur-md'
              : item.type === 'warning'
              ? 'bg-amber-900/90 text-white border-amber-700/80 backdrop-blur-md'
              : 'bg-slate-900/90 text-white border-slate-700/80 backdrop-blur-md'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {item.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
            {item.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />}
            {item.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />}
            {item.type === 'info' && <Info className="w-5 h-5 text-sky-400 shrink-0" />}
            <span className="leading-snug break-words">{item.message}</span>
          </div>
          <button
            onClick={() => toast.dismiss(item.id)}
            className="p-1 text-white/70 hover:text-white rounded-lg hover:bg-white/10 shrink-0 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
