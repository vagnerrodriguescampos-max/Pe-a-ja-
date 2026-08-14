'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import clsx from 'clsx';

export interface Option { value: string; label: string }

export function MultiSelect({
  label, options, selected, onChange, placeholder = 'Todos', disabled,
}: {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const filtered = options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()));

  function toggle(value: string) {
    if (selected.includes(value)) onChange(selected.filter((v) => v !== value));
    else onChange([...selected, value]);
  }

  return (
    <div className="relative min-w-[150px]" ref={ref}>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-base-muted">{label}</label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          'flex w-full items-center justify-between gap-2 rounded-lg border border-base-border bg-base-surface px-2.5 py-1.5 text-left text-xs',
          disabled ? 'cursor-not-allowed opacity-50' : 'hover:border-brand-500/50'
        )}
      >
        <span className="truncate text-base-text">
          {selected.length === 0 ? placeholder : selected.length === 1 ? options.find((o) => o.value === selected[0])?.label ?? selected[0] : `${selected.length} selecionados`}
        </span>
        <ChevronDown size={14} className="shrink-0 text-base-muted" />
      </button>

      {open && !disabled && (
        <div className="absolute left-0 top-full z-40 mt-1 w-64 rounded-lg border border-base-border bg-base-surface p-2 shadow-card">
          <div className="mb-1.5 flex items-center gap-1.5">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar..."
              className="w-full rounded-md border border-base-border bg-base-surface2 px-2 py-1 text-xs outline-none focus:border-brand-500"
            />
            {selected.length > 0 && (
              <button onClick={() => onChange([])} className="shrink-0 text-base-muted hover:text-bad" title="Limpar">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="max-h-56 overflow-y-auto scrollbar-thin">
            {filtered.length === 0 && <p className="px-2 py-2 text-xs text-base-muted">Nenhuma opção</p>}
            {filtered.map((o) => (
              <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-base-surface2">
                <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} className="accent-brand-600" />
                <span className="truncate text-base-text">{o.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
