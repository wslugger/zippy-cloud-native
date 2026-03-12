'use client';

import { X } from 'lucide-react';

type NoticeVariant = 'success' | 'error' | 'info';
type NoticeSize = 'sm' | 'md';

interface InlineNoticeProps {
    variant: NoticeVariant;
    message: string;
    size?: NoticeSize;
    onDismiss?: () => void;
}

export function InlineNotice({ variant, message, size = 'sm', onDismiss }: InlineNoticeProps) {
    const variantClass =
        variant === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : variant === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-700'
                : 'bg-slate-50 border-slate-200 text-slate-700';

    const sizeClass = size === 'md'
        ? 'px-4 py-3 text-sm font-medium'
        : 'px-3 py-2 text-xs font-medium';

    return (
        <div className={`rounded-lg border flex items-center gap-2 ${variantClass} ${sizeClass}`}>
            <p>{message}</p>
            {onDismiss && (
                <button onClick={onDismiss} className="ml-auto opacity-70 hover:opacity-100" aria-label="Dismiss notice">
                    <X size={14} />
                </button>
            )}
        </div>
    );
}
