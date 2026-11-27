import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Clock,
  Loader2,
  MapPin,
  MessageCircle,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useOrcaData } from '../contexts/OrcaDataContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  cancelSportEvent,
  joinSportEvent,
  leaveSportEvent,
} from '../services/firestoreService';
import type { EventParticipant, SportEvent } from '../types/orca';
import {
  calculateDistanceKm,
  formatDistanceKm,
  formatEventTime,
  formatPriceBRL,
  getSportMeta,
} from '../utils/sports';
import { UserAvatar } from './UserAvatar';

interface EventDetailModalProps {
  event: SportEvent | null;
  onClose: () => void;
  onOpenChat: (chatId: string) => void;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  event,
  onClose,
  onOpenChat,
}) => {
  const { userProfile, coords } = useAuth();
  const { joinedEventIds, refreshJoinedEvents } = useOrcaData();

  const [participants, setParticipants] = useState<EventParticipant[]>([]);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!event) {
      setParticipants([]);
      return;
    }
    const q = query(
      collection(db, 'events', event.id, 'participants'),
      orderBy('joinedAt', 'asc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setParticipants(snap.docs.map((d) => d.data() as EventParticipant));
      },
      (err) => {
        handleFirestoreError(
          err,
          OperationType.LIST,
          `events/${event.id}/participants`
        );
      }
    );
    return () => unsub();
  }, [event?.id]);

  if (!event || !userProfile) return null;

  const isHost = event.hostId === userProfile.uid;
  const isJoined =
    joinedEventIds.includes(event.id) ||
    participants.some((p) => p.uid === userProfile.uid);
  const isFull = event.participantsCount >= event.maxParticipants;
  const distKm = coords
    ? calculateDistanceKm(coords.lat, coords.lng, event.lat, event.lng)
    : null;
  const meta = getSportMeta(event.sport);

  const handleJoin = async () => {
    setBusy(true);
    setErrorMsg(null);
    try {
      await joinSportEvent(event, userProfile);
      await refreshJoinedEvents();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao entrar no evento.');
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async () => {
    setBusy(true);
    setErrorMsg(null);
    try {
      await leaveSportEvent(event, userProfile);
      await refreshJoinedEvents();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao sair do evento.');
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    setBusy(true);
    setErrorMsg(null);
    try {
      await cancelSportEvent(event.id);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao cancelar evento.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-[#0B0E15] border border-white/10 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Cover */}
        <div className="relative h-48 shrink-0">
          <img
            src={event.coverURL || meta.coverURL}
            alt={event.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0E15] via-black/35 to-transparent" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar detalhes"
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="absolute bottom-4 left-5 right-5">
            <div className="text-xs font-semibold text-cyan-400">
              {event.sport} · {event.level}
            </div>
            <h2 className="text-2xl font-display font-bold text-white leading-tight">
              {event.title}
            </h2>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {errorMsg && (
            <div className="text-xs text-rose-200 bg-rose-500/15 border border-rose-500/30 rounded-xl px-4 py-3">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-[#111520] border border-white/8 space-y-1">
              <div className="text-slate-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-rose-400" />
                Horário
              </div>
              <div className="font-semibold text-white">
                {formatEventTime(event.startsAtMs)}
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#111520] border border-white/8 space-y-1">
              <div className="text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                Duração e Valor
              </div>
              <div className="font-semibold text-white">
                {event.durationMinutes} min · {formatPriceBRL(event.price)}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#111520] border border-white/8 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
                {event.venueName}
              </div>
              {distKm !== null && (
                <span className="text-xs font-mono-num text-cyan-300 shrink-0">
                  {formatDistanceKm(distKm)}
                </span>
              )}
            </div>
            {event.address && (
              <p className="text-xs text-slate-400 pl-5">{event.address}</p>
            )}
          </div>

          {event.description && (
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-slate-400">Sobre o jogo</div>
              <p className="text-sm text-slate-300 leading-relaxed">
                {event.description}
              </p>
            </div>
          )}

          {/* Real Confirmed Participants */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-cyan-400" />
                Atletas Confirmados
              </span>
              <span className="font-mono-num text-slate-400">
                {participants.length || event.participantsCount}/{event.maxParticipants}
              </span>
            </div>
            <div className="space-y-2">
              {participants.map((p) => (
                <div
                  key={p.uid}
                  className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[#10141F] border border-white/6"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <UserAvatar name={p.displayName} photoURL={p.photoURL} size="xs" />
                    <span className="text-xs font-medium text-white truncate">
                      {p.displayName}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 shrink-0">
                    {p.role === 'host' ? 'Anfitrião' : 'Confirmado'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-white/8 bg-[#090B10] flex flex-wrap items-center gap-2.5">
          {isJoined && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenChat(event.chatId);
              }}
              className="flex-1 py-3 px-4 rounded-xl bg-cyan-500/18 hover:bg-cyan-500/28 border border-cyan-400/35 text-xs font-bold text-cyan-200 inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              Abrir Chat
            </button>
          )}

          {isHost ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleCancel()}
              className="py-3 px-4 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-xs font-bold text-rose-200 inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              Cancelar Evento
            </button>
          ) : isJoined ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleLeave()}
              className="py-3 px-4 rounded-xl bg-white/8 hover:bg-white/12 text-xs font-semibold text-slate-200 cursor-pointer"
            >
              {busy ? 'Saindo...' : 'Sair do Evento'}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy || isFull}
              onClick={() => void handleJoin()}
              className="w-full py-3.5 px-5 rounded-2xl orca-gradient-btn text-white font-display font-bold text-sm inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {busy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Confirmando...
                </>
              ) : isFull ? (
                'Vagas Esgotadas'
              ) : (
                'Entrar no Evento (+50 XP)'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
