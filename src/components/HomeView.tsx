import React, { useMemo, useState } from 'react';
import {
  Bell,
  Calendar,
  Compass,
  MapPin,
  Plus,
  Radio,
  Users,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useOrcaData } from '../contexts/OrcaDataContext';
import type { AppTab, SportEvent, SportType, UserPublic } from '../types/orca';
import {
  calculateDistanceKm,
  formatDistanceKm,
  formatEventTime,
  formatPriceBRL,
  getSportMeta,
  SPORTS_CATALOG,
} from '../utils/sports';
import { OrcaLogo } from './OrcaLogo';
import { EventCardSkeleton } from './Skeletons';
import { UserAvatar } from './UserAvatar';

interface HomeViewProps {
  onOpenCreateEvent: () => void;
  onNavigateTab: (tab: AppTab) => void;
  onSelectEvent: (event: SportEvent) => void;
  onSelectAthlete: (athlete: UserPublic) => void;
  onOpenNotifications: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onOpenCreateEvent,
  onNavigateTab,
  onSelectEvent,
  onSelectAthlete,
  onOpenNotifications,
}) => {
  const { userProfile, coords, geoStatus, detectedCity, requestGeolocation } = useAuth();
  const {
    events,
    eventsLoading,
    onlineAthletes,
    joinedEventIds,
    unreadNotificationsCount,
  } = useOrcaData();

  const [selectedSport, setSelectedSport] = useState<'Todos' | SportType>('Todos');

  const filteredEvents = useMemo(() => {
    const base =
      selectedSport === 'Todos'
        ? events
        : events.filter((ev) => ev.sport === selectedSport);

    if (!coords) return base;
    return [...base].sort((a, b) => {
      const da = calculateDistanceKm(coords.lat, coords.lng, a.lat, a.lng);
      const db = calculateDistanceKm(coords.lat, coords.lng, b.lat, b.lng);
      return da - db;
    });
  }, [events, selectedSport, coords]);

  const otherOnlineAthletes = useMemo(
    () => onlineAthletes.filter((a) => a.uid !== userProfile?.uid),
    [onlineAthletes, userProfile?.uid]
  );

  const locationLabel =
    detectedCity ||
    userProfile?.city ||
    (geoStatus === 'requesting' ? 'Localizando GPS...' : 'Ativar GPS');

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 lg:pb-12 pt-4 sm:pt-6 space-y-8">
      {/* Compact Header on Mobile (desktop uses persistent top bar too) */}
      <div className="flex items-center justify-between gap-4 lg:hidden">
        <OrcaLogo size="sm" showTagline />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={requestGeolocation}
            className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white px-2.5 py-2 rounded-xl bg-white/5 border border-white/10 max-w-[155px] cursor-pointer"
          >
            <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="truncate">{locationLabel}</span>
          </button>
          <button
            type="button"
            onClick={onOpenNotifications}
            aria-label="Notificações"
            className="relative w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-200 cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center">
                {unreadNotificationsCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('profile')}
            aria-label="Abrir perfil"
            className="cursor-pointer"
          >
            <UserAvatar
              name={userProfile?.displayName}
              photoURL={userProfile?.photoURL}
              size="sm"
              isOnline={userProfile?.isOnline}
            />
          </button>
        </div>
      </div>

      {/* Hero Section */}
      <section className="rounded-3xl bg-[#0C0F16] border border-white/8 p-6 sm:p-8 lg:p-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
        <div className="space-y-4 max-w-2xl">
          <p className="text-sm text-slate-400">
            Olá,{' '}
            <span className="text-slate-100 font-semibold">
              {userProfile?.displayName || 'Atleta'}
            </span>
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-extrabold tracking-tight leading-[1.08] text-balance">
            Encontre sua{' '}
            <span className="orca-gradient-text">próxima partida.</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-xl leading-relaxed">
            Eventos esportivos reais criados por atletas na sua região, com chat em tempo real e radar ao vivo.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onNavigateTab('radar')}
              className="px-5 py-3 rounded-2xl orca-gradient-btn text-white font-semibold text-sm inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer shadow-lg shadow-cyan-500/10"
            >
              <Compass className="w-4 h-4" />
              Explorar Eventos
            </button>
            <button
              type="button"
              onClick={onOpenCreateEvent}
              className="px-5 py-3 rounded-2xl bg-white/6 hover:bg-white/10 border border-white/12 text-white font-semibold text-sm inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              Criar Partida
            </button>
          </div>
        </div>

        {/* Real-time live pulse summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-3 lg:w-64 shrink-0">
          <div className="rounded-2xl bg-[#07090E] border border-white/8 p-4">
            <div className="text-xs text-slate-400">Eventos Ativos</div>
            <div className="text-2xl font-display font-bold font-mono-num text-white mt-1">
              {events.length}
            </div>
          </div>
          <div className="rounded-2xl bg-[#07090E] border border-white/8 p-4">
            <div className="text-xs text-slate-400">Atletas Online Agora</div>
            <div className="text-2xl font-display font-bold font-mono-num text-cyan-400 mt-1">
              {onlineAthletes.length}
            </div>
          </div>
          <div className="col-span-2 sm:col-span-1 rounded-2xl bg-[#07090E] border border-white/8 p-4">
            <div className="text-xs text-slate-400">Localização Atual</div>
            <button
              type="button"
              onClick={requestGeolocation}
              className="mt-1 text-sm font-medium text-slate-200 hover:text-cyan-300 flex items-center gap-1.5 truncate w-full text-left cursor-pointer"
            >
              <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="truncate">{locationLabel}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Interactive Sport Filter Tabs */}
      <section className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-display font-bold tracking-tight">
            Eventos Próximos
          </h2>
          <button
            type="button"
            onClick={() => onNavigateTab('radar')}
            className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Ver no Radar
          </button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedSport('Todos')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              selectedSport === 'Todos'
                ? 'bg-white text-slate-950'
                : 'bg-[#0E1117] text-slate-400 hover:text-white border border-white/8'
            }`}
          >
            Todos
          </button>
          {SPORTS_CATALOG.map((sport) => (
            <button
              key={sport.id}
              type="button"
              onClick={() => setSelectedSport(sport.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                selectedSport === sport.id
                  ? 'bg-white text-slate-950'
                  : 'bg-[#0E1117] text-slate-400 hover:text-white border border-white/8'
              }`}
            >
              {sport.label}
            </button>
          ))}
        </div>

        {/* Real Events Grid or Premium Empty State */}
        {eventsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <EventCardSkeleton />
            <EventCardSkeleton />
            <EventCardSkeleton />
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="rounded-3xl bg-[#0C0F16] border border-white/8 p-10 sm:p-14 text-center space-y-5">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-400/25 flex items-center justify-center text-cyan-400">
              <Radio className="w-7 h-7" />
            </div>
            <div className="space-y-2 max-w-md mx-auto">
              <h3 className="text-xl font-display font-bold text-white">
                Nenhum evento próximo encontrado.
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                {selectedSport === 'Todos'
                  ? 'Ainda não há partidas publicadas nesta região. Seja o primeiro atleta a abrir uma arena real agora.'
                  : `Nenhum evento de ${selectedSport} disponível no momento. Crie uma partida e convide atletas próximos.`}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={onOpenCreateEvent}
                className="px-6 py-3.5 rounded-2xl orca-gradient-btn text-white font-display font-bold text-sm inline-flex items-center gap-2 cursor-pointer shadow-lg shadow-rose-500/15"
              >
                <Plus className="w-4 h-4" />
                Criar Primeiro Evento
              </button>
              {selectedSport !== 'Todos' && (
                <button
                  type="button"
                  onClick={() => setSelectedSport('Todos')}
                  className="px-5 py-3.5 rounded-2xl bg-white/6 hover:bg-white/10 border border-white/10 text-sm font-medium text-slate-200 cursor-pointer"
                >
                  Mostrar todos os esportes
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredEvents.map((ev) => {
              const meta = getSportMeta(ev.sport);
              const distKm = coords
                ? calculateDistanceKm(coords.lat, coords.lng, ev.lat, ev.lng)
                : null;
              const isJoined = joinedEventIds.includes(ev.id);
              const isFull = ev.participantsCount >= ev.maxParticipants;

              return (
                <article
                  key={ev.id}
                  onClick={() => onSelectEvent(ev)}
                  className="group rounded-2xl bg-[#0E1117] hover:bg-[#121620] border border-white/8 hover:border-white/15 overflow-hidden transition-all cursor-pointer flex flex-col"
                >
                  <div className="relative h-44 bg-[#07090E] overflow-hidden">
                    <img
                      src={ev.coverURL || meta.coverURL}
                      alt={ev.title}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0E1117] via-black/30 to-transparent" />
                    <div className="absolute top-3 left-3 text-[11px] font-semibold tracking-wider text-white/95 bg-black/55 backdrop-blur-md px-2.5 py-1 rounded-lg">
                      {ev.sport}
                    </div>
                    <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-2">
                      <h3 className="text-lg font-display font-bold text-white leading-snug truncate">
                        {ev.title}
                      </h3>
                    </div>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs text-slate-300 truncate">
                        <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span className="truncate">{ev.venueName}</span>
                        {distKm !== null && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-num text-cyan-300 shrink-0">
                              {formatDistanceKm(distKm)}
                            </span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-rose-400" />
                          {formatEventTime(ev.startsAtMs)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-num">
                          {ev.participantsCount}/{ev.maxParticipants} atletas
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{ev.level}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-slate-200 font-medium">
                          {formatPriceBRL(ev.price)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-white/6">
                      <div className="flex items-center gap-2 min-w-0">
                        <UserAvatar
                          name={ev.hostName}
                          photoURL={ev.hostPhotoURL}
                          size="xs"
                        />
                        <span className="text-xs text-slate-300 truncate">
                          {ev.hostName}
                        </span>
                      </div>

                      <span
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 ${
                          isJoined
                            ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                            : isFull
                            ? 'bg-white/5 text-slate-400'
                            : 'bg-white text-slate-950'
                        }`}
                      >
                        {isJoined ? 'Confirmado' : isFull ? 'Lotado' : 'Entrar'}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Real Online Athletes Strip */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-cyan-400" />
            <h2 className="text-lg font-display font-bold tracking-tight">
              Atletas Online Agora
            </h2>
          </div>
          <span className="text-xs font-mono-num text-slate-400">
            {otherOnlineAthletes.length} conectados
          </span>
        </div>

        {otherOnlineAthletes.length === 0 ? (
          <div className="rounded-2xl bg-[#0C0F16] border border-white/8 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-sm text-slate-400">
              Você está online agora. Convide seus amigos para entrar no ORCA e montar partidas em tempo real.
            </p>
            <button
              type="button"
              onClick={() => onNavigateTab('chat')}
              className="px-4 py-2.5 rounded-xl bg-white/8 hover:bg-white/12 text-xs font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer"
            >
              Abrir Conecta Arena
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {otherOnlineAthletes.slice(0, 8).map((athlete) => {
              const dist =
                coords && athlete.lat !== undefined && athlete.lng !== undefined
                  ? calculateDistanceKm(coords.lat, coords.lng, athlete.lat, athlete.lng)
                  : null;
              return (
                <button
                  key={athlete.uid}
                  type="button"
                  onClick={() => onSelectAthlete(athlete)}
                  className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#0E1117] hover:bg-[#131823] border border-white/8 text-left transition-colors cursor-pointer"
                >
                  <UserAvatar
                    name={athlete.displayName}
                    photoURL={athlete.photoURL}
                    size="md"
                    isOnline={athlete.isOnline}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-white truncate">
                      {athlete.displayName}
                    </div>
                    <div className="text-xs text-slate-400 truncate">
                      @{athlete.username}
                      {dist !== null ? ` · ${formatDistanceKm(dist)}` : athlete.city ? ` · ${athlete.city}` : ''}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
