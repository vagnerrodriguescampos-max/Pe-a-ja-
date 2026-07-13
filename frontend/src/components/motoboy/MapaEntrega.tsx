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
  html: '<div style="font-size:28px;line-height:1">🛵</div>',
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const destinoIcon = new L.DivIcon({
  html: '<div style="font-size:24px;line-height:1">📍</div>',
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
