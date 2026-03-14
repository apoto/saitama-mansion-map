"use client";

import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import StationMarkers from "./StationMarkers";
import type { StationData, FilterState } from "@/lib/types";
import { SAITAMA_CENTER, DEFAULT_ZOOM } from "@/lib/constants";

interface Props {
  stations: StationData[];
  filter: FilterState;
}

export default function MapView({ stations, filter }: Props) {
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
      <StationMarkers stations={stations} filter={filter} />
    </MapContainer>
  );
}
