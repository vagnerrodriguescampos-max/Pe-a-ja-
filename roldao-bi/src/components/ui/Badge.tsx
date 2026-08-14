import clsx from 'clsx';

const VARIANTS = {
  neutral: 'bg-base-surface2 text-base-muted border-base-border',
  good: 'bg-good/10 text-good border-good/30',
  warn: 'bg-warn/10 text-warn border-warn/30',
  bad: 'bg-bad/10 text-bad border-bad/30',
  info: 'bg-info/10 text-info border-info/30',
  brand: 'bg-brand-500/10 text-brand-400 border-brand-500/30',
};

export function Badge({ variant = 'neutral', className, children }: { variant?: keyof typeof VARIANTS; className?: string; children: React.ReactNode }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium', VARIANTS[variant], className)}>
      {children}
    </span>
  );
}
