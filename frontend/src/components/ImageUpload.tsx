'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Upload, X, Loader2 } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Props {
  value?: string;
  onChange: (url: string) => void;
  label?: string;
  previewSize?: number;
}

export default function ImageUpload({ value, onChange, label, previewSize = 64 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) { setError('Apenas imagens JPG, PNG ou WEBP'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Tamanho máximo: 5MB'); return; }
    setError('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const token = localStorage.getItem('admin_token');
      const r = await fetch(`${API}/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!r.ok) throw new Error('Falha no upload');
      const { url } = await r.json();
      onChange(url);
    } catch {
      setError('Erro ao enviar imagem. Tente novamente.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="relative flex-shrink-0 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 hover:border-red-400 hover:bg-red-50 transition-colors overflow-hidden"
          style={{ width: previewSize, height: previewSize }}
        >
          {uploading ? (
            <div className="w-full h-full flex items-center justify-center">
              <Loader2 size={20} className="text-red-400 animate-spin" />
            </div>
          ) : value ? (
            <Image src={value} alt="preview" fill className="object-cover" unoptimized />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-gray-400">
              <Upload size={18} />
              <span className="text-xs">Upload</span>
            </div>
          )}
        </button>

        <div className="flex-1">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              {uploading ? 'Enviando...' : value ? 'Trocar foto' : 'Enviar foto'}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => { onChange(''); setError(''); }}
                className="text-sm text-red-500 hover:text-red-700 px-3 py-2 rounded-xl hover:bg-red-50 transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">JPG, PNG ou WEBP · máx. 5MB</p>
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
    </div>
  );
}
