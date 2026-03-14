"use client";

import { MapContainer, TileLayer, LayersControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import StationMarkers from "./StationMarkers";
import type { StationData, FilterState } from "@/lib/types";
import { SAITAMA_CENTER, DEFAULT_ZOOM } from "@/lib/constants";

interface Props {
  stations: StationData[];
  filter: FilterState;
  onStationClick?: (station: StationData) => void;
  highlightedStations?: Set<string>;
}

export default function MapView({ stations, filter, onStationClick, highlightedStations }: Props) {
  return (
    <MapContainer
      center={[SAITAMA_CENTER.lat, SAITAMA_CENTER.lng]}
      zoom={DEFAULT_ZOOM}
      className="h-full w-full rounded-lg"
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {filter.showHazard && (
        <TileLayer
          url="https://disaportal.gsi.go.jp/hazardmap/hazardmaptile/v2/0/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://disaportal.gsi.go.jp/">国土交通省 ハザードマップポータルサイト</a>'
          opacity={0.6}
          zIndex={400}
        />
      )}
      <StationMarkers
        stations={stations}
        filter={filter}
        onStationClick={onStationClick}
        highlightedStations={highlightedStations}
      />
    </MapContainer>
  );
}
