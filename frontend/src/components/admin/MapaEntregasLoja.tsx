'use client';

import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export type EntregaAtiva = {
  pedido_id: string;
  numero_sequencial: number;
  motoboy_id: string | null;
  motoboy_nome: string | null;
  endereco_entrega: any;
  total: number | string;
  criado_em: string;
  posicao: { lat: number; lng: number; atualizado_em: string } | null;
};

// Marcador com o número do pedido embutido: com várias entregas simultâneas no mapa,
// o número é o que deixa o operador identificar cada moto sem precisar clicar.
function iconeMotoboy(numero: number, destacado: boolean) {
  const cor = destacado ? '#ff6a45' : '#b3a996';
  return new L.DivIcon({
    html: `<div style="display:flex;flex-direction:column;align-items:center;line-height:1;filter:drop-shadow(0 1px 3px rgba(0,0,0,.6))">
      <span style="background:${cor};color:#14110e;font:700 11px/1 system-ui,sans-serif;padding:3px 6px;border-radius:99px;white-space:nowrap">#${numero}</span>
      <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="${cor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-top:-2px">
        <circle cx="18.5" cy="17.5" r="3.5"/>
        <circle cx="5.5" cy="17.5" r="3.5"/>
        <circle cx="15" cy="5" r="1"/>
        <path d="M12 17.5V14l-3-3 4-3 2 3h2"/>
      </svg>
    </div>`,
    className: '',
    iconSize: [40, 44],
    iconAnchor: [20, 40],
  });
}

// Enquadra todas as entregas na primeira carga e sempre que uma moto entra ou sai
// do mapa — mas não a cada ping de GPS, senão o mapa "pula" durante o uso.
function AjustarEnquadramento({ pontos }: { pontos: [number, number][] }) {
  const map = useMap();
  const chave = pontos.length;

  useEffect(() => {
    if (!pontos.length) return;
    if (pontos.length === 1) {
      map.setView(pontos[0], 15);
      return;
    }
    map.fitBounds(L.latLngBounds(pontos), { padding: [48, 48], maxZoom: 16 });
  }, [chave]);

  return null;
}

type Props = {
  entregas: EntregaAtiva[];
  pedidoDestacado?: string | null;
  onSelecionar?: (pedidoId: string) => void;
};

export default function MapaEntregasLoja({ entregas, pedidoDestacado, onSelecionar }: Props) {
  const comPosicao = useMemo(
    () => entregas.filter(e => e.posicao),
    [entregas],
  );

  const pontos = useMemo(
    () => comPosicao.map(e => [e.posicao!.lat, e.posicao!.lng] as [number, number]),
    [comPosicao],
  );

  const centro = pontos[0] ?? ([-23.5505, -46.6333] as [number, number]);

  return (
    <MapContainer center={centro} zoom={13} style={{ height: '100%', width: '100%' }} className="z-0">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <AjustarEnquadramento pontos={pontos} />

      {comPosicao.map(e => (
        <Marker
          key={e.pedido_id}
          position={[e.posicao!.lat, e.posicao!.lng]}
          icon={iconeMotoboy(e.numero_sequencial, pedidoDestacado === e.pedido_id)}
          eventHandlers={onSelecionar ? { click: () => onSelecionar(e.pedido_id) } : undefined}
        >
          <Popup>
            <strong>Pedido #{e.numero_sequencial}</strong>
            <br />
            {e.motoboy_nome || 'Motoboy não identificado'}
            {e.endereco_entrega && (
              <>
                <br />
                {e.endereco_entrega.rua}, {e.endereco_entrega.numero}
              </>
            )}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
