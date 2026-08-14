'use client';

import { useEffect, useRef, useState } from 'react';

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/** Busca um endpoint da API interna e refaz a busca sempre que `path` mudar. */
export function useApi<T>(path: string | null): ApiState<T> {
  const [state, setState] = useState<ApiState<T>>({ data: null, loading: !!path, error: null });
  const seq = useRef(0);

  useEffect(() => {
    if (!path) return;
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetch(path)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Falha ao carregar dados');
        return json as T;
      })
      .then((json) => {
        if (seq.current === id) setState({ data: json, loading: false, error: null });
      })
      .catch((err) => {
        if (seq.current === id) setState({ data: null, loading: false, error: err.message });
      });
  }, [path]);

  return state;
}
