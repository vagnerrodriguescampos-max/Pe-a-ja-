import clsx from 'clsx';

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx('overflow-x-auto rounded-lg border border-base-border', className)}>
      <table className="w-full min-w-[640px] border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className, align = 'left' }: { children: React.ReactNode; className?: string; align?: 'left' | 'right' | 'center' }) {
  return (
    <th
      className={clsx(
        'sticky top-0 z-10 whitespace-nowrap border-b border-base-border bg-base-surface2 px-3.5 py-2.5 text-xs font-semibold uppercase tracking-wide text-base-muted',
        align === 'right' && 'text-right', align === 'center' && 'text-center', align === 'left' && 'text-left',
        className
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className, align = 'left', title }: { children: React.ReactNode; className?: string; align?: 'left' | 'right' | 'center'; title?: string }) {
  return (
    <td
      title={title}
      className={clsx(
        'whitespace-nowrap border-b border-base-border/70 px-3.5 py-2.5 text-base-text',
        align === 'right' && 'text-right', align === 'center' && 'text-center', align === 'left' && 'text-left',
        className
      )}
    >
      {children}
    </td>
  );
}

export function Tr({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <tr
      onClick={onClick}
      className={clsx('transition-colors', onClick && 'cursor-pointer hover:bg-base-surface2/70', className)}
    >
      {children}
    </tr>
  );
}
