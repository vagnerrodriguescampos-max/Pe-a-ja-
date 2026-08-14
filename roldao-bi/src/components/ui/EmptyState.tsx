import { Inbox } from 'lucide-react';
import Link from 'next/link';

export function EmptyState({ title, description, ctaHref, ctaLabel }: { title: string; description?: string; ctaHref?: string; ctaLabel?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl2 border border-dashed border-base-border bg-base-surface2/50 px-6 py-14 text-center">
      <div className="rounded-full bg-base-surface p-3 text-base-muted">
        <Inbox size={22} />
      </div>
      <p className="text-sm font-semibold text-base-text">{title}</p>
      {description && <p className="max-w-sm text-sm text-base-muted">{description}</p>}
      {ctaHref && ctaLabel && (
        <Link href={ctaHref} className="mt-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
