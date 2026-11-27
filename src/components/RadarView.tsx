import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Compass,
  Crosshair,
  MapPin,
  Minus,
  Plus,
  Radio,
  Users,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useOrcaData } from '../contexts/OrcaDataContext';
import type { SportEvent, SportType, UserPublic } from '../types/orca';
import {
  calculateBearingDeg,
  calculateDistanceKm,
  formatDistanceKm,
  formatEventTime,
  formatPriceBRL,
  getSportMeta,
  SPORTS_CATALOG,
} from '../utils/sports';
import { UserAvatar } from './UserAvatar';

interface RadarViewProps {
  onOpenCreateEvent: () => void;
  onSelectEvent: (event: SportEvent) => void;
  onSelectAthlete: (athlete: UserPublic) => void;
}

const RADIUS_OPTIONS = [5, 15, 30, 50, 500];

export const RadarView: React.FC<RadarViewProps> = ({
  onOpenCreateEvent,
  onSelectEvent,
  onSelectAthlete,
}) => {
  const { userProfile, coords, geoStatus, detectedCity, requestGeolocation } = useAuth();
  const { events, onlineAthletes, joinedEventIds } = useOrcaData();

  const [sportFilter, setSportFilter] = useState<'Todos' | SportType>('Todos');
  const [radiusKm, setRadiusKm] = useState<number>(30);
  const [todayOnly, setTodayOnly] = useState(false);
  const [showAthletes, setShowAthletes] = useState(true);
  const [zoomScale, setZoomScale] = useState(1);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const filteredEvents = useMemo(() => {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    return events
      .filter((ev) => {
        if (sportFilter !== 'Todos' && ev.sport !== sportFilter) return false;
        if (todayOnly && ev.startsAtMs > endOfToday.getTime()) return false;
        if (coords && radiusKm < 500) {
          const d = calculateDistanceKm(coords.lat, coords.lng, ev.lat, ev.lng);
          if (d > radiusKm) return false;
        }
        return true;
      })
      .map((ev) => ({
        event: ev,
        distanceKm: coords
          ? calculateDistanceKm(coords.lat, coords.lng, ev.lat, ev.lng)
          : null,
        bearingDeg: coords
          ? calculateBearingDeg(coords.lat, coords.lng, ev.lat, ev.lng)
          : 0,
      }))
      .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  }, [events, sportFilter, todayOnly, coords, radiusKm]);

  const radarAthletes = useMemo(() => {
    if (!showAthletes) return [];
    return onlineAthletes
      .filter((a) => {
        if (a.uid === userProfile?.uid) return false;
        if (!a.shareLocation || a.lat === undefined || a.lng === undefined) return false;
        if (coords && radiusKm < 500) {
          return calculateDistanceKm(coords.lat, coords.lng, a.lat, a.lng) <= radiusKm;
        }
        return true;
      })
      .map((athlete) => ({
        athlete,
        distanceKm: coords
          ? calculateDistanceKm(coords.lat, coords.lng, athlete.lat!, athlete.lng!)
          : null,
        bearingDeg: coords
          ? calculateBearingDeg(coords.lat, coords.lng, athlete.lat!, athlete.lng!)
          : 0,
      }));
  }, [showAthletes, onlineAthletes, userProfile?.uid, coords, radiusKm]);

  const activeEventEntry = useMemo(() => {
    if (selectedEventId) {
      const match = filteredEvents.find((item) => item.event.id === selectedEventId);
      if (match) return match;
    }
    return filteredEvents[0] || null;
  }, [filteredEvents, selectedEventId]);

  const effectiveMaxRadius = Math.max(1, (radiusKm >= 500 ? 100 : radiusKm) / zoomScale);

  const projectToRadarPercent = (distanceKm: number | null, bearingDeg: number) => {
    if (distanceKm === null) {
      return { left: 50, top: 50 };
    }
    const clampedRatio = Math.min(0.88, Math.max(0.08, (distanceKm / effectiveMaxRadius) * 0.85));
    const rad = ((bearingDeg - 90) * Math.PI) / 180;
    const x = 50 + Math.cos(rad) * clampedRatio * 46;
    const y = 50 + Math.sin(rad) * clampedRatio * 46;
    return { left: x, top: y };
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 lg:pb-10 pt-4 space-y-5">
      {/* Header & Real Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Radio className="w-5 h-5 text-cyan-400" />
          <h1 className="text-2xl font-display font-bold tracking-tight">Radar</h1>
          <span className="text-xs text-slate-400 font-mono-num">
            · {filteredEvents.length} eventos · {radarAthletes.length} atletas
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <select
            value={sportFilter}
            onChange={(e) => setSportFilter(e.target.value as 'Todos' | SportType)}
            aria-label="Filtrar esporte"
            className="px-3.5 py-2 rounded-xl bg-[#0E1117] border border-white/10 text-xs font-semibold text-white focus:border-cyan-400 focus:outline-none cursor-pointer"
          >
            <option value="Todos">Todos os esportes</option>
            {SPORTS_CATALOG.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>

          <select
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
            aria-label="Filtrar distância"
            className="px-3.5 py-2 rounded-xl bg-[#0E1117] border border-white/10 text-xs font-semibold text-white focus:border-cyan-400 focus:outline-none cursor-pointer"
          >
            {RADIUS_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r >= 500 ? 'Qualquer distância' : `Até ${r} km`}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setTodayOnly((prev) => !prev)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border whitespace-nowrap shrink-0 cursor-pointer ${
              todayOnly
                ? 'bg-rose-500/20 border-rose-400/50 text-rose-200'
                : 'bg-[#0E1117] border-white/10 text-slate-300'
            }`}
          >
            Hoje
          </button>

          <button
            type="button"
            onClick={() => setShowAthletes((prev) => !prev)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              showAthletes
                ? 'bg-cyan-500/15 border-cyan-400/40 text-cyan-200'
                : 'bg-[#0E1117] border-white/10 text-slate-400'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Atletas
          </button>
        </div>
      </div>

      {/* GPS Permission Prompt if coordinates unavailable */}
      {!coords && (
        <div className="rounded-2xl bg-[#0E1117] border border-cyan-400/25 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Compass className="w-5 h-5 text-cyan-400 shrink-0" />
            <div className="text-xs text-slate-300">
              {geoStatus === 'denied'
                ? 'Permissão de localização negada no navegador. Ative o GPS para calcular distâncias reais no radar.'
                : 'Ative sua localização real para posicionar você no centro do radar e filtrar por distância.'}
            </div>
          </div>
          <button
            type="button"
            onClick={requestGeolocation}
            className="px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-xs font-semibold text-cyan-200 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Ativar GPS Agora
          </button>
        </div>
      )}

      {/* Main Radar Canvas + Selected Event Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Interactive Radar Viewport */}
        <div className="lg:col-span-7 xl:col-span-8 relative rounded-3xl bg-[#07090F] border border-white/10 overflow-hidden min-h-[420px] sm:min-h-[500px] select-none">
          {/* Subtle topographic grid */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.12) 1px, transparent 1px)',
              backgroundSize: '44px 44px',
            }}
          />

          {/* Concentric Radar Rings */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[82%] aspect-square max-w-[460px] rounded-full border border-cyan-400/15 relative flex items-center justify-center">
              <div className="w-[66%] aspect-square rounded-full border border-cyan-400/20 flex items-center justify-center">
                <div className="w-[45%] aspect-square rounded-full border border-rose-400/20" />
              </div>
              {/* Radar Sweep */}
              <div
                className="absolute inset-0 rounded-full animate-radar-sweep opacity-35"
                style={{
                  background:
                    'conic-gradient(from 0deg, rgba(34,211,238,0.22) 0deg, transparent 58deg, transparent 360deg)',
                }}
              />
            </div>
          </div>

          {/* Center User Marker (Real GPS Position) */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center"
            title={detectedCity || 'Sua posição real'}
          >
            <div className="w-5 h-5 rounded-full bg-cyan-400 border-4 border-[#07090F] shadow-[0_0_24px_rgba(34,211,238,0.8)]" />
            <span className="mt-1 text-[10px] font-medium text-cyan-200 bg-black/70 px-2 py-0.5 rounded whitespace-nowrap">
              Você {detectedCity ? `· ${detectedCity.split(',')[0]}` : ''}
            </span>
          </div>

          {/* Real Active Event Pins */}
          {filteredEvents.map(({ event, distanceKm, bearingDeg }, idx) => {
            const pos = coords
              ? projectToRadarPercent(distanceKm, bearingDeg)
              : {
                  left: 25 + ((idx * 23) % 52),
                  top: 24 + ((idx * 19) % 52),
                };
            const isSelected = activeEventEntry?.event.id === event.id;
            return (
              <button
                key={event.id}
                type="button"
                onClick={() => setSelectedEventId(event.id)}
                style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 group cursor-pointer transition-transform ${
                  isSelected ? 'scale-115 z-30' : 'hover:scale-110'
                }`}
                title={`${event.title} (${event.sport})`}
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-colors ${
                    isSelected
                      ? 'bg-rose-500 border-white text-white shadow-[0_0_28px_rgba(244,63,94,0.85)]'
                      : 'bg-[#121726]/90 border-rose-400 text-rose-300 shadow-[0_0_16px_rgba(244,63,94,0.45)]'
                  }`}
                >
                  <MapPin className="w-4 h-4" />
                </div>
                <span className="mt-1 block text-[10px] font-semibold text-white bg-black/80 px-2 py-0.5 rounded whitespace-nowrap max-w-[120px] truncate">
                  {event.title}
                </span>
              </button>
            );
          })}

          {/* Real Online Athletes Pins */}
          {radarAthletes.map(({ athlete, distanceKm, bearingDeg }, idx) => {
            const pos = coords
              ? projectToRadarPercent(distanceKm, bearingDeg)
              : {
                  left: 20 + ((idx * 29) % 60),
                  top: 22 + ((idx * 31) % 56),
                };
            return (
              <button
                key={athlete.uid}
                type="button"
                onClick={() => onSelectAthlete(athlete)}
                style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-15 hover:scale-110 transition-transform cursor-pointer"
                title={`${athlete.displayName} (Online)`}
              >
                <UserAvatar
                  name={athlete.displayName}
                  photoURL={athlete.photoURL}
                  size="xs"
                  isOnline
                />
              </button>
            );
          })}

          {/* Radar Controls */}
          <div className="absolute right-3 top-3 z-30 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setZoomScale((z) => Math.min(3, Number((z + 0.5).toFixed(1))))}
              aria-label="Aproximar radar"
              className="w-10 h-10 rounded-xl bg-[#0E1117]/90 border border-white/12 flex items-center justify-center text-white hover:bg-[#171D2A] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoomScale((z) => Math.max(0.5, Number((z - 0.5).toFixed(1))))}
              aria-label="Afastar radar"
              className="w-10 h-10 rounded-xl bg-[#0E1117]/90 border border-white/12 flex items-center justify-center text-white hover:bg-[#171D2A] cursor-pointer"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setZoomScale(1);
                requestGeolocation();
              }}
              aria-label="Centralizar na minha localização"
              className="w-10 h-10 rounded-xl bg-[#0E1117]/90 border border-white/12 flex items-center justify-center text-cyan-400 hover:bg-[#171D2A] cursor-pointer"
            >
              <Crosshair className="w-4 h-4" />
            </button>
          </div>

          {/* Scale Legend */}
          <div className="absolute left-4 bottom-4 z-20 text-[11px] font-mono-num text-slate-400 bg-black/65 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/8">
            Raio exibido: {Math.round(effectiveMaxRadius)} km
          </div>
        </div>

        {/* Right / Bottom Detail Panel */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-4">
          {activeEventEntry ? (
            <div className="rounded-3xl bg-[#0E1117] border border-white/10 overflow-hidden flex flex-col justify-between">
              <div className="relative h-40">
                <img
                  src={
                    activeEventEntry.event.coverURL ||
                    getSportMeta(activeEventEntry.event.sport).coverURL
                  }
                  alt={activeEventEntry.event.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0E1117] via-black/35 to-transparent" />
                <div className="absolute bottom-3 left-4 right-4">
                  <div className="text-xs font-semibold text-cyan-400">
                    {activeEventEntry.event.sport}
                  </div>
                  <h2 className="text-xl font-display font-bold text-white truncate">
                    {activeEventEntry.event.title}
                  </h2>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div className="text-xs text-slate-300 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span className="truncate">
                      {activeEventEntry.event.venueName}
                    </span>
                    {activeEventEntry.distanceKm !== null && (
                      <span className="font-mono-num text-cyan-300 shrink-0">
                        · {formatDistanceKm(activeEventEntry.distanceKm)}
                      </span>
                    )}
                  </div>
                  <div className="text-slate-400">
                    {activeEventEntry.event.participantsCount}/
                    {activeEventEntry.event.maxParticipants} jogadores ·{' '}
                    {activeEventEntry.event.level} ·{' '}
                    {formatPriceBRL(activeEventEntry.event.price)}
                  </div>
                  <div className="text-rose-300 font-medium">
                    {formatEventTime(activeEventEntry.event.startsAtMs)}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 pt-3 border-t border-white/8">
                  <UserAvatar
                    name={activeEventEntry.event.hostName}
                    photoURL={activeEventEntry.event.hostPhotoURL}
                    size="sm"
                  />
                  <div className="text-xs text-slate-300">
                    <span className="text-white font-semibold">
                      {activeEventEntry.event.hostName}
                    </span>{' '}
                    · Anfitrião
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectEvent(activeEventEntry.event)}
                  className="w-full py-3.5 px-5 rounded-2xl orca-gradient-btn text-white font-display font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  {joinedEventIds.includes(activeEventEntry.event.id) ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Ver Detalhes & Chat
                    </>
                  ) : (
                    'Entrar no Evento'
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl bg-[#0C0F16] border border-white/8 p-7 text-center space-y-4 my-auto">
              <Radio className="w-8 h-8 text-cyan-400 mx-auto" />
              <div className="space-y-1.5">
                <h3 className="text-lg font-display font-bold text-white">
                  Nenhum evento ativo neste raio
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Amplie o filtro de distância ou crie um novo evento na sua localização real agora.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={onOpenCreateEvent}
                  className="w-full py-3 px-4 rounded-xl orca-gradient-btn text-white text-xs font-bold cursor-pointer"
                >
                  Criar Evento Aqui
                </button>
                {radiusKm < 500 && (
                  <button
                    type="button"
                    onClick={() => setRadiusKm(500)}
                    className="w-full py-2.5 px-4 rounded-xl bg-white/8 hover:bg-white/12 text-xs font-semibold text-slate-200 cursor-pointer"
                  >
                    Expandir para Qualquer Distância
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Quick list of nearby events */}
          {filteredEvents.length > 1 && (
            <div className="rounded-2xl bg-[#0B0E15] border border-white/8 p-3 space-y-1.5 max-h-56 overflow-y-auto">
              <div className="text-[11px] font-semibold text-slate-400 px-2 py-1">
                Outros eventos no radar
              </div>
              {filteredEvents.map(({ event, distanceKm }) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => setSelectedEventId(event.id)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                    activeEventEntry?.event.id === event.id
                      ? 'bg-white/10 text-white'
                      : 'hover:bg-white/5 text-slate-300'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">{event.title}</div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {event.sport} · {event.venueName}
                    </div>
                  </div>
                  <span className="text-[11px] font-mono-num text-cyan-300 shrink-0">
                    {distanceKm !== null ? formatDistanceKm(distanceKm) : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
