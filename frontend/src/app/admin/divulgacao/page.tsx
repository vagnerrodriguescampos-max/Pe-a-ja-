'use client';

import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import AdminLayout from '@/components/admin/AdminLayout';
import { adminGetLoja, adminRelatorioPorOrigem } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Copy, Download, QrCode, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';

type LinhaOrigem = { origem: string; pedidos: number; receita: number };

/**
 * Canal vira slug porque ele entra na URL e no relatório: "QR da Mesa" e
 * "qr da mesa" precisam cair no mesmo grupo, senão o lojista vê o mesmo canal
 * dividido em várias linhas. Formato casa com a validação do backend.
 */
// Marcas de acento que o NFD separa da letra. Montado com new RegExp para o
// escape \u ficar explícito no código (literal traria o caractere invisível) e
// para não depender da flag /u, indisponível no target de compilação do projeto.
const ACENTOS = new RegExp('[\\u0300-\\u036f]', 'g');

function paraSlug(texto: string) {
  return texto
    // NFD separa a letra do acento; remover só o acento preserva a letra
    // ("Promoção" -> "promocao", e não "promoc-a-o").
    .normalize('NFD')
    .replace(ACENTOS, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

const SUGESTOES = ['Instagram', 'WhatsApp', 'Panfleto', 'QR da Mesa', 'Fachada', 'Sacola'];

export default function DivulgacaoPage() {
  const [slug, setSlug] = useState('');
  const [canal, setCanal] = useState('');
  const [qr, setQr] = useState('');
  const [dias, setDias] = useState(30);
  const [linhas, setLinhas] = useState<LinhaOrigem[]>([]);
  const [carregando, setCarregando] = useState(true);

  const canalSlug = paraSlug(canal);
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  const link = slug
    ? `${base}/loja/${slug}${canalSlug ? `?origem=${canalSlug}` : ''}`
    : '';

  useEffect(() => {
    adminGetLoja()
      .then(loja => setSlug(loja.slug))
      .catch(() => toast.error('Não foi possível carregar os dados da loja'));
  }, []);

  const carregarRelatorio = useCallback(() => {
    setCarregando(true);
    adminRelatorioPorOrigem(dias)
      .then(setLinhas)
      .catch(() => toast.error('Não foi possível carregar o relatório'))
      .finally(() => setCarregando(false));
  }, [dias]);

  useEffect(() => { carregarRelatorio(); }, [carregarRelatorio]);

  // QR redesenhado a cada mudança de link — é ele que o cliente aponta a câmera.
  useEffect(() => {
    if (!link) { setQr(''); return; }
    QRCode.toDataURL(link, { width: 640, margin: 2 })
      .then(setQr)
      .catch(() => setQr(''));
  }, [link]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Link copiado');
    } catch {
      toast.error('Não foi possível copiar. Selecione o link e copie manualmente.');
    }
  }

  function baixarQr() {
    const a = document.createElement('a');
    a.href = qr;
    a.download = `qrcode-${canalSlug || 'loja'}.png`;
    a.click();
  }

  const totalPedidos = linhas.reduce((acc, l) => acc + l.pedidos, 0);

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-page-title text-gray-900">Divulgação</h1>
          <p className="text-caption text-gray-500 mt-1">
            Gere um link e um QR Code para cada canal e descubra qual deles traz pedido de verdade.
          </p>
        </div>

        {/* Gerador de link */}
        <div className="card p-5">
          <h2 className="text-section-title text-gray-900 mb-1">Criar link de divulgação</h2>
          <p className="text-caption text-gray-500 mb-4">
            Dê um nome ao canal onde o link vai aparecer. Cada canal é contado separadamente.
          </p>

          <input
            value={canal}
            onChange={e => setCanal(e.target.value)}
            placeholder="Ex: Instagram, Panfleto, QR da Mesa"
            className="input"
            maxLength={50}
          />

          <div className="flex flex-wrap gap-2 mt-3">
            {SUGESTOES.map(s => (
              <button
                key={s}
                onClick={() => setCanal(s)}
                className="text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>

          {link && (
            <div className="mt-5 flex flex-col md:flex-row gap-5 items-start">
              <div className="flex-1 min-w-0 w-full">
                <label className="text-caption text-gray-500">Link para compartilhar</label>
                <div className="mt-1 p-3 rounded-xl bg-gray-50 border border-gray-200 break-all text-sm text-gray-800">
                  {link}
                </div>
                {!canalSlug && (
                  <p className="text-caption text-gray-400 mt-2">
                    Sem nome de canal, este é o link normal da loja — os pedidos entram como “direto”.
                  </p>
                )}
                <div className="flex gap-2 mt-3">
                  <button onClick={copiar} className="btn-admin-primary py-2.5 px-4 inline-flex items-center gap-2">
                    <Copy size={16} /> Copiar link
                  </button>
                  {qr && (
                    <button
                      onClick={baixarQr}
                      className="py-2.5 px-4 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 inline-flex items-center gap-2 transition-colors"
                    >
                      <Download size={16} /> Baixar QR
                    </button>
                  )}
                </div>
              </div>

              {qr && (
                <div className="shrink-0 mx-auto md:mx-0">
                  {/* Fundo branco fixo: QR em superfície escura não é lido pela câmera. */}
                  <div className="bg-white p-3 rounded-xl">
                    <img src={qr} alt={`QR Code do canal ${canal || 'loja'}`} className="w-40 h-40" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Relatório */}
        <div className="card p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-section-title text-gray-900">De onde vêm seus pedidos</h2>
              <p className="text-caption text-gray-500 mt-1">
                {totalPedidos > 0
                  ? `${totalPedidos} pedido(s) no período`
                  : 'Nenhum pedido no período'}
              </p>
            </div>
            <select
              value={dias}
              onChange={e => setDias(Number(e.target.value))}
              className="input w-auto py-2"
            >
              <option value={7}>7 dias</option>
              <option value={30}>30 dias</option>
              <option value={90}>90 dias</option>
            </select>
          </div>

          {carregando ? (
            <div className="py-10 flex justify-center">
              <div className="w-6 h-6 border-2 border-[var(--admin-accent)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : linhas.length === 0 ? (
            <div className="py-10 text-center">
              <QrCode className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-body text-gray-600">Ainda não há pedidos neste período.</p>
              <p className="text-caption text-gray-400 mt-1">
                Crie um link acima, divulgue e volte aqui para ver o que deu resultado.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {linhas.map(l => {
                const fatia = totalPedidos > 0 ? (l.pedidos / totalPedidos) * 100 : 0;
                return (
                  <div key={l.origem} className="p-3 rounded-xl bg-gray-50">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {l.origem === 'direto' ? 'Direto (sem link de campanha)' : l.origem}
                      </span>
                      <span className="text-sm font-semibold text-gray-900 shrink-0">
                        {formatCurrency(l.receita)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[var(--admin-accent)]"
                          style={{ width: `${fatia}%` }}
                        />
                      </div>
                      <span className="text-caption text-gray-500 shrink-0">
                        {l.pedidos} ({fatia.toFixed(0)}%)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {linhas.length > 0 && (
            <p className="text-caption text-gray-400 mt-4 inline-flex items-center gap-1.5">
              <TrendingUp size={14} />
              Pedidos cancelados não entram na conta.
            </p>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
