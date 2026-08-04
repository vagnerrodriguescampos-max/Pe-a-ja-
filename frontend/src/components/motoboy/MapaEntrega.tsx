'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const motoboyIcon = new L.DivIcon({
  html: `<div style="color:var(--admin-accent);filter:drop-shadow(0 1px 2px rgba(0,0,0,.5));line-height:0">
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="18.5" cy="17.5" r="3.5"/>
      <circle cx="5.5" cy="17.5" r="3.5"/>
      <circle cx="15" cy="5" r="1"/>
      <path d="M12 17.5V14l-3-3 4-3 2 3h2"/>
    </svg>
  </div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const destinoIcon = new L.DivIcon({
  html: `<div style="color:var(--admin-accent);filter:drop-shadow(0 1px 2px rgba(0,0,0,.5));line-height:0">
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
      <circle cx="12" cy="10" r="3" fill="white" stroke="none"/>
    </svg>
  </div>`,
  className: '',
  iconSize: [24, 32],
  iconAnchor: [12, 32],
});

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng]);
  return null;
}

type Props = {
  posicaoMotoboy: { lat: number; lng: number } | null;
  enderecoEntrega?: any;
  posicaoDestino?: { lat: number; lng: number } | null;
};

export default function MapaEntrega({ posicaoMotoboy, enderecoEntrega, posicaoDestino }: Props) {
  const center = posicaoMotoboy || posicaoDestino || { lat: -23.5505, lng: -46.6333 };

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={15}
      style={{ height: '100%', width: '100%' }}
      className="z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {posicaoMotoboy && (
        <>
          <Marker position={[posicaoMotoboy.lat, posicaoMotoboy.lng]} icon={motoboyIcon}>
            <Popup>Motoboy</Popup>
          </Marker>
          <RecenterMap lat={posicaoMotoboy.lat} lng={posicaoMotoboy.lng} />
        </>
      )}

      {posicaoDestino && (
        <Marker position={[posicaoDestino.lat, posicaoDestino.lng]} icon={destinoIcon}>
          <Popup>Destino da entrega</Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
