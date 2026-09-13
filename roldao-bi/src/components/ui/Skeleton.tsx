import type { CSSProperties } from 'react';
import clsx from 'clsx';

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={clsx('skeleton rounded-md', className)} style={style} />;
}
