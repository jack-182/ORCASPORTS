import React, { useMemo, useState } from 'react';
import {
  Award,
  Camera,
  Check,
  Edit3,
  LogOut,
  ShieldCheck,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useOrcaData } from '../contexts/OrcaDataContext';
import {
  acceptFriendRequest,
  removeFriendship,
  sendFriendRequest,
  updateUserProfile,
  uploadMediaFile,
} from '../services/firestoreService';
import type { SportEvent, SportType, UserPublic } from '../types/orca';
import {
  computeLevelFromXp,
  computeRealAchievements,
  formatEventTime,
  SPORTS_CATALOG,
} from '../utils/sports';
import { UserAvatar } from './UserAvatar';

interface ProfileViewProps {
  onSelectEvent: (event: SportEvent) => void;
  onSelectAthlete: (athlete: UserPublic) => void;
}

type ProfileTab = 'events' | 'friends' | 'settings';

export const ProfileView: React.FC<ProfileViewProps> = ({
  onSelectEvent,
  onSelectAthlete,
}) => {
  const { userProfile, userPrivate, logout } = useAuth();
  const { events, joinedEventIds, friendships, athletes } = useOrcaData();

  const [tab, setTab] = useState<ProfileTab>('events');
  const [editing, setEditing] = useState(false);

  const [displayNameInput, setDisplayNameInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [cityInput, setCityInput] = useState('');
  const [bioInput, setBioInput] = useState('');
  const [favSportsInput, setFavSportsInput] = useState<SportType[]>([]);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [friendSearch, setFriendSearch] = useState('');

  const levelInfo = useMemo(
    () => computeLevelFromXp(userProfile?.xp || 0),
    [userProfile?.xp]
  );

  const acceptedFriends = useMemo(() => {
    if (!userProfile) return [];
    const friendUids = friendships
      .filter((f) => f.status === 'accepted')
      .map((f) => ({
        friendshipId: f.id,
        uid: f.users.find((u) => u !== userProfile.uid) || '',
      }));

    return friendUids
      .map((entry) => ({
        friendshipId: entry.friendshipId,
        athlete: athletes.find((a) => a.uid === entry.uid),
      }))
      .filter((item): item is { friendshipId: string; athlete: UserPublic } =>
        Boolean(item.athlete)
      );
  }, [friendships, athletes, userProfile]);

  const incomingRequests = useMemo(() => {
    if (!userProfile) return [];
    return friendships
      .filter((f) => f.status === 'pending' && f.recipientId === userProfile.uid)
      .map((f) => ({
        friendship: f,
        requester: athletes.find((a) => a.uid === f.requesterId),
      }))
      .filter((item) => Boolean(item.requester));
  }, [friendships, athletes, userProfile]);

  const myEvents = useMemo(() => {
    if (!userProfile) return [];
    return events.filter(
      (ev) => ev.hostId === userProfile.uid || joinedEventIds.includes(ev.id)
    );
  }, [events, joinedEventIds, userProfile]);

  const achievements = useMemo(
    () => computeRealAchievements(userProfile, acceptedFriends.length),
    [userProfile, acceptedFriends.length]
  );

  const discoverToAdd = useMemo(() => {
    if (!userProfile) return [];
    const connectedIds = new Set(
      friendships.flatMap((f) => f.users)
    );
    const q = friendSearch.toLowerCase().trim();
    return athletes
      .filter((a) => a.uid !== userProfile.uid && !connectedIds.has(a.uid))
      .filter(
        (a) =>
          !q ||
          a.displayName.toLowerCase().includes(q) ||
          a.username.toLowerCase().includes(q)
      );
  }, [athletes, friendships, userProfile, friendSearch]);

  if (!userProfile) return null;

  const openEditor = () => {
    setDisplayNameInput(userProfile.displayName);
    setUsernameInput(userProfile.username);
    setCityInput(userProfile.city || '');
    setBioInput(userProfile.bio || '');
    setFavSportsInput(userProfile.favoriteSports || []);
    setEditing(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg(null);
    try {
      await updateUserProfile(userProfile.uid, {
        displayName: displayNameInput,
        username: usernameInput,
        city: cityInput,
        bio: bioInput,
        favoriteSports: favSportsInput,
      });
      setEditing(false);
      setStatusMsg('Perfil atualizado com sucesso.');
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Erro ao salvar perfil.');
    } finally {
      setSaving(false);
    }
  };

  const handleMediaUpload = async (
    kind: 'avatars' | 'banners',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatusMsg(null);
    try {
      const url = await uploadMediaFile(userProfile.uid, kind, file);
      await updateUserProfile(
        userProfile.uid,
        kind === 'avatars' ? { photoURL: url } : { bannerURL: url }
      );
      setStatusMsg(kind === 'avatars' ? 'Foto atualizada.' : 'Capa atualizada.');
    } catch {
      setStatusMsg(
        'Upload de arquivo indisponível no momento — verifique as regras do Firebase Storage.'
      );
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 lg:pb-12 pt-4 space-y-6">
      {/* Banner + Avatar Header */}
      <section className="rounded-3xl bg-[#0C0F16] border border-white/10 overflow-hidden">
        <div className="relative h-36 sm:h-44 bg-gradient-to-r from-cyan-950/60 via-[#0F1522] to-rose-950/60">
          {userProfile.bannerURL && (
            <img
              src={userProfile.bannerURL}
              alt="Banner do atleta"
              className="w-full h-full object-cover opacity-80"
            />
          )}
          <label className="absolute right-4 top-4 px-3 py-2 rounded-xl bg-black/60 hover:bg-black/80 border border-white/15 text-xs font-medium text-white inline-flex items-center gap-1.5 cursor-pointer">
            <Camera className="w-3.5 h-3.5" />
            Capa
            <input
              type="file"
              accept="image/*"
              onChange={(e) => void handleMediaUpload('banners', e)}
              className="hidden"
            />
          </label>
        </div>

        <div className="px-6 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-10 sm:-mt-12">
            <div className="flex items-end gap-4">
              <div className="relative">
                <UserAvatar
                  name={userProfile.displayName}
                  photoURL={userProfile.photoURL}
                  size="xl"
                  isOnline={userProfile.isOnline}
                  className="ring-4 ring-[#0C0F16]"
                />
                <label
                  title="Alterar avatar"
                  className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#161C29] border border-white/20 flex items-center justify-center text-white cursor-pointer hover:bg-cyan-500/30"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => void handleMediaUpload('avatars', e)}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="pb-1">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-2xl font-display font-bold text-white">
                    {userProfile.displayName}
                  </h1>
                  <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                </div>
                <p className="text-xs text-slate-400">
                  @{userProfile.username}
                  {userProfile.city ? ` · ${userProfile.city}` : ''} · {levelInfo.tierLabel}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openEditor}
                className="px-4 py-2.5 rounded-xl bg-white/8 hover:bg-white/12 border border-white/10 text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Editar
              </button>
              <button
                type="button"
                onClick={() => void logout()}
                className="px-4 py-2.5 rounded-xl bg-rose-500/12 hover:bg-rose-500/20 border border-rose-500/25 text-xs font-semibold text-rose-300 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sair
              </button>
            </div>
          </div>

          {userProfile.bio && (
            <p className="mt-4 text-sm text-slate-300 leading-relaxed max-w-2xl">
              {userProfile.bio}
            </p>
          )}

          {/* Real Stats Row */}
          <div className="grid grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/8 text-center">
            <div>
              <div className="text-xl font-display font-bold font-mono-num text-white">
                {userProfile.matchesCount}
              </div>
              <div className="text-[11px] text-slate-400">Partidas</div>
            </div>
            <div>
              <div className="text-xl font-display font-bold font-mono-num text-white">
                {userProfile.eventsHostedCount}
              </div>
              <div className="text-[11px] text-slate-400">Criados</div>
            </div>
            <div>
              <div className="text-xl font-display font-bold font-mono-num text-white">
                {acceptedFriends.length}
              </div>
              <div className="text-[11px] text-slate-400">Amigos</div>
            </div>
            <div>
              <div className="text-xl font-display font-bold font-mono-num text-cyan-400">
                {userProfile.xp}
              </div>
              <div className="text-[11px] text-slate-400">XP Total</div>
            </div>
          </div>

          {/* Real XP Level Progress */}
          <div className="mt-5 p-4 rounded-2xl bg-[#07090F] border border-white/8 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono-num font-semibold text-white">
                {levelInfo.currentLevelXp} / {levelInfo.nextLevelXp} XP
              </span>
              <span className="text-cyan-400 font-semibold">
                Nível {levelInfo.level}
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/8 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-rose-500 via-pink-500 to-cyan-400 transition-all duration-300"
                style={{ width: `${levelInfo.progressPct}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {statusMsg && (
        <div className="text-xs text-cyan-200 bg-cyan-500/12 border border-cyan-500/25 rounded-xl px-4 py-3">
          {statusMsg}
        </div>
      )}

      {/* Real Achievements */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-400" />
          <h2 className="text-base font-display font-bold">Conquistas Reais</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {achievements.map((ach) => (
            <div
              key={ach.id}
              className={`rounded-2xl p-4 border transition-colors ${
                ach.unlocked
                  ? 'bg-[#101521] border-amber-400/35'
                  : 'bg-[#0A0C12] border-white/6 opacity-65'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-white">{ach.title}</span>
                {ach.unlocked && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                {ach.description}
              </p>
              <div className="text-[11px] font-mono-num text-cyan-300 mt-2">
                {ach.progressLabel}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Profile Tabs */}
      <div className="grid grid-cols-3 p-1 rounded-2xl bg-[#0D1017] border border-white/8 max-w-md">
        {(
          [
            { id: 'events', label: `Eventos (${myEvents.length})` },
            { id: 'friends', label: `Amigos (${acceptedFriends.length})` },
            { id: 'settings', label: 'Privacidade' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`py-2.5 text-xs font-semibold rounded-xl cursor-pointer whitespace-nowrap ${
              tab === t.id
                ? 'bg-[#171E2C] text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'events' && (
        <div className="space-y-3">
          {myEvents.length === 0 ? (
            <div className="rounded-2xl bg-[#0C0F16] border border-white/8 p-8 text-center text-sm text-slate-400">
              Você ainda não criou nem confirmou presença em nenhum evento.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {myEvents.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => onSelectEvent(ev)}
                  className="p-4 rounded-2xl bg-[#0E1117] hover:bg-[#131823] border border-white/8 text-left flex items-center justify-between gap-3 cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="text-xs text-cyan-400 font-semibold">
                      {ev.sport} · {ev.hostId === userProfile.uid ? 'Anfitrião' : 'Inscrito'}
                    </div>
                    <div className="text-sm font-bold text-white truncate mt-0.5">
                      {ev.title}
                    </div>
                    <div className="text-xs text-slate-400 truncate mt-0.5">
                      {ev.venueName} · {formatEventTime(ev.startsAtMs)}
                    </div>
                  </div>
                  <span className="text-xs font-mono-num text-slate-300 shrink-0">
                    {ev.participantsCount}/{ev.maxParticipants}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'friends' && (
        <div className="space-y-5">
          {incomingRequests.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold text-cyan-400">
                Solicitações Recebidas ({incomingRequests.length})
              </h3>
              {incomingRequests.map(({ friendship, requester }) =>
                requester ? (
                  <div
                    key={friendship.id}
                    className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#101521] border border-cyan-400/25"
                  >
                    <button
                      type="button"
                      onClick={() => onSelectAthlete(requester)}
                      className="flex items-center gap-3 text-left min-w-0 cursor-pointer"
                    >
                      <UserAvatar
                        name={requester.displayName}
                        photoURL={requester.photoURL}
                        size="sm"
                        isOnline={requester.isOnline}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate">
                          {requester.displayName}
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          @{requester.username}
                        </div>
                      </div>
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          void acceptFriendRequest(
                            friendship.id,
                            requester.uid,
                            userProfile
                          )
                        }
                        className="px-3.5 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-xs font-semibold text-cyan-200 cursor-pointer"
                      >
                        Aceitar
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeFriendship(friendship.id)}
                        className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-400 cursor-pointer"
                      >
                        Recusar
                      </button>
                    </div>
                  </div>
                ) : null
              )}
            </div>
          )}

          {/* Accepted Friends */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold text-slate-400">
              Conexões Reais ({acceptedFriends.length})
            </h3>
            {acceptedFriends.length === 0 ? (
              <p className="text-xs text-slate-500">
                Você ainda não tem amigos adicionados. Conecte-se com atletas abaixo.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {acceptedFriends.map(({ friendshipId, athlete }) => (
                  <div
                    key={friendshipId}
                    className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#0E1117] border border-white/8"
                  >
                    <button
                      type="button"
                      onClick={() => onSelectAthlete(athlete)}
                      className="flex items-center gap-3 min-w-0 text-left cursor-pointer"
                    >
                      <UserAvatar
                        name={athlete.displayName}
                        photoURL={athlete.photoURL}
                        size="sm"
                        isOnline={athlete.isOnline}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate">
                          {athlete.displayName}
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          @{athlete.username}
                        </div>
                      </div>
                    </button>
                    <span className="text-[11px] text-emerald-400 inline-flex items-center gap-1 shrink-0">
                      <UserCheck className="w-3.5 h-3.5" />
                      Amigo
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Search & Add Real Athletes */}
          <div className="space-y-3 pt-3 border-t border-white/8">
            <h3 className="text-xs font-semibold text-slate-300">
              Encontrar Atletas Reais na Rede
            </h3>
            <input
              type="text"
              value={friendSearch}
              onChange={(e) => setFriendSearch(e.target.value)}
              placeholder="Filtrar por nome ou @usuário..."
              className="w-full px-4 py-2.5 rounded-xl bg-[#0D1017] border border-white/10 text-sm text-white focus:border-cyan-400 focus:outline-none"
            />
            {discoverToAdd.length === 0 ? (
              <p className="text-xs text-slate-500">
                Nenhum novo atleta disponível para conectar no momento.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {discoverToAdd.slice(0, 6).map((athlete) => (
                  <div
                    key={athlete.uid}
                    className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#0C0F16] border border-white/8"
                  >
                    <button
                      type="button"
                      onClick={() => onSelectAthlete(athlete)}
                      className="flex items-center gap-3 min-w-0 text-left cursor-pointer"
                    >
                      <UserAvatar
                        name={athlete.displayName}
                        photoURL={athlete.photoURL}
                        size="sm"
                        isOnline={athlete.isOnline}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate">
                          {athlete.displayName}
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          @{athlete.username}
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => void sendFriendRequest(userProfile, athlete)}
                      className="px-3 py-2 rounded-xl bg-white/8 hover:bg-white/15 text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Conectar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <div className="rounded-2xl bg-[#0C0F16] border border-white/8 p-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-white">
                Compartilhar localização no Radar ao vivo
              </div>
              <div className="text-xs text-slate-400">
                Permite que atletas próximos vejam quando você está online no radar.
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                void updateUserProfile(userProfile.uid, {
                  shareLocation: !userProfile.shareLocation,
                })
              }
              className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                userProfile.shareLocation
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/40'
                  : 'bg-white/8 text-slate-400 border border-white/10'
              }`}
            >
              {userProfile.shareLocation ? 'Ativo' : 'Desativado'}
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 pt-3 border-t border-white/8">
            <div>
              <div className="text-sm font-semibold text-white">
                Perfil visível na busca de atletas
              </div>
              <div className="text-xs text-slate-400">
                Permite que outros jogadores encontrem seu perfil e enviem pedidos de amizade.
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                void updateUserProfile(userProfile.uid, {
                  discoverable: !userProfile.discoverable,
                })
              }
              className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                userProfile.discoverable
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/40'
                  : 'bg-white/8 text-slate-400 border border-white/10'
              }`}
            >
              {userProfile.discoverable ? 'Visível' : 'Oculto'}
            </button>
          </div>

          {userPrivate?.email && (
            <div className="pt-3 border-t border-white/8 text-xs text-slate-400">
              E-mail privado da conta:{' '}
              <span className="text-slate-200">{userPrivate.email}</span>
            </div>
          )}
        </div>
      )}

      {/* Edit Profile Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-3xl bg-[#0E1117] border border-white/10 p-6 space-y-4 max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-display font-bold">Editar Perfil</h3>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="p-2 rounded-full hover:bg-white/10 text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">Nome</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={60}
                  value={displayNameInput}
                  onChange={(e) => setDisplayNameInput(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#07090F] border border-white/10 text-sm text-white focus:border-cyan-400 focus:outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">Usuário (@)</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={32}
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#07090F] border border-white/10 text-sm text-white focus:border-cyan-400 focus:outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">Cidade</label>
                <input
                  type="text"
                  maxLength={80}
                  value={cityInput}
                  onChange={(e) => setCityInput(e.target.value)}
                  placeholder="Ex.: São Paulo, SP"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#07090F] border border-white/10 text-sm text-white focus:border-cyan-400 focus:outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">Bio esportiva</label>
                <textarea
                  rows={3}
                  maxLength={240}
                  value={bioInput}
                  onChange={(e) => setBioInput(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#07090F] border border-white/10 text-sm text-white focus:border-cyan-400 focus:outline-none resize-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 block">
                  Esportes favoritos
                </label>
                <div className="flex flex-wrap gap-2">
                  {SPORTS_CATALOG.map((s) => {
                    const active = favSportsInput.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() =>
                          setFavSportsInput((prev) =>
                            active
                              ? prev.filter((item) => item !== s.id)
                              : prev.length < 8
                              ? [...prev, s.id]
                              : prev
                          )
                        }
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer ${
                          active
                            ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200'
                            : 'bg-[#07090F] border-white/10 text-slate-400'
                        }`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 rounded-xl orca-gradient-btn text-white text-sm font-bold cursor-pointer disabled:opacity-60"
              >
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
