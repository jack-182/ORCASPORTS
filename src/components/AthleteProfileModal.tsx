import React, { useMemo, useState } from 'react';
import {
  MapPin,
  MessageCircle,
  ShieldCheck,
  UserCheck,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useOrcaData } from '../contexts/OrcaDataContext';
import {
  acceptFriendRequest,
  getFriendshipId,
  removeFriendship,
  sendFriendRequest,
  startOrGetDirectChat,
} from '../services/firestoreService';
import type { UserPublic } from '../types/orca';
import {
  calculateDistanceKm,
  computeLevelFromXp,
  formatDistanceKm,
} from '../utils/sports';
import { UserAvatar } from './UserAvatar';

interface AthleteProfileModalProps {
  athlete: UserPublic | null;
  onClose: () => void;
  onOpenChat: (chatId: string) => void;
}

export const AthleteProfileModal: React.FC<AthleteProfileModalProps> = ({
  athlete,
  onClose,
  onOpenChat,
}) => {
  const { userProfile, coords } = useAuth();
  const { friendships } = useOrcaData();
  const [busy, setBusy] = useState(false);

  const friendship = useMemo(() => {
    if (!athlete || !userProfile) return null;
    const fId = getFriendshipId(userProfile.uid, athlete.uid);
    return friendships.find((f) => f.id === fId) || null;
  }, [athlete, userProfile, friendships]);

  if (!athlete || !userProfile) return null;

  const isSelf = athlete.uid === userProfile.uid;
  const levelInfo = computeLevelFromXp(athlete.xp);
  const distKm =
    coords && athlete.lat !== undefined && athlete.lng !== undefined && athlete.shareLocation
      ? calculateDistanceKm(coords.lat, coords.lng, athlete.lat, athlete.lng)
      : null;

  const handleMessage = async () => {
    setBusy(true);
    try {
      const conv = await startOrGetDirectChat(userProfile, athlete);
      onClose();
      onOpenChat(conv.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="max-w-md w-full rounded-3xl bg-[#0C0F16] border border-white/10 overflow-hidden">
        <div className="p-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <UserAvatar
                name={athlete.displayName}
                photoURL={athlete.photoURL}
                size="lg"
                isOnline={athlete.isOnline}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xl font-display font-bold text-white truncate">
                    {athlete.displayName}
                  </h3>
                  <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                </div>
                <p className="text-xs text-slate-400 truncate">
                  @{athlete.username} · Nível {levelInfo.level} ({levelInfo.tierLabel})
                </p>
                {(athlete.city || distKm !== null) && (
                  <p className="text-xs text-cyan-300 flex items-center gap-1 mt-1">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="truncate">
                      {athlete.city || 'Localização ativa'}
                      {distKm !== null ? ` · ${formatDistanceKm(distKm)}` : ''}
                    </span>
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 text-slate-400 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {athlete.bio && (
            <p className="text-sm text-slate-300 leading-relaxed">{athlete.bio}</p>
          )}

          {athlete.favoriteSports && athlete.favoriteSports.length > 0 && (
            <div className="text-xs text-slate-400">
              Esportes:{' '}
              <span className="text-slate-200">
                {athlete.favoriteSports.join(' · ')}
              </span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 p-3.5 rounded-2xl bg-[#07090F] border border-white/8 text-center">
            <div>
              <div className="text-lg font-display font-bold font-mono-num text-white">
                {athlete.matchesCount}
              </div>
              <div className="text-[11px] text-slate-400">Partidas</div>
            </div>
            <div>
              <div className="text-lg font-display font-bold font-mono-num text-white">
                {athlete.eventsHostedCount}
              </div>
              <div className="text-[11px] text-slate-400">Criados</div>
            </div>
            <div>
              <div className="text-lg font-display font-bold font-mono-num text-cyan-400">
                {athlete.xp}
              </div>
              <div className="text-[11px] text-slate-400">XP</div>
            </div>
          </div>

          {!isSelf && (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleMessage()}
                className="flex-1 py-3 px-4 rounded-xl orca-gradient-btn text-white text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                Mensagem
              </button>

              {!friendship ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await sendFriendRequest(userProfile, athlete);
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="py-3 px-4 rounded-xl bg-white/8 hover:bg-white/14 border border-white/12 text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  Conectar
                </button>
              ) : friendship.status === 'pending' &&
                friendship.recipientId === userProfile.uid ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await acceptFriendRequest(
                        friendship.id,
                        athlete.uid,
                        userProfile
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="py-3 px-4 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-xs font-semibold text-cyan-200 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <UserCheck className="w-4 h-4" />
                  Aceitar
                </button>
              ) : friendship.status === 'pending' ? (
                <span className="py-3 px-4 rounded-xl bg-white/5 text-xs text-slate-400">
                  Solicitado
                </span>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await removeFriendship(friendship.id);
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="py-3 px-4 rounded-xl bg-white/6 hover:bg-rose-500/15 border border-white/10 text-xs text-slate-300 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <UserMinus className="w-4 h-4" />
                  Remover
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
