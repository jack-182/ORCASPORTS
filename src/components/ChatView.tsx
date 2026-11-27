import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Image as ImageIcon,
  Loader2,
  MessageSquarePlus,
  Plus,
  Search,
  Send,
  Users,
  X,
} from 'lucide-react';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useOrcaData } from '../contexts/OrcaDataContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  createSportGroup,
  joinSportGroup,
  sendMessage,
  setTypingState,
  startOrGetDirectChat,
  uploadMediaFile,
} from '../services/firestoreService';
import type {
  ChatMessage,
  Conversation,
  SportType,
  UserPublic,
} from '../types/orca';
import { formatRelativeTimestamp, SPORTS_CATALOG } from '../utils/sports';
import { ChatListSkeleton } from './Skeletons';
import { UserAvatar } from './UserAvatar';

interface ChatViewProps {
  initialConversationId?: string | null;
  onClearInitialConversation?: () => void;
  onBackToHome: () => void;
  onSelectAthlete: (athlete: UserPublic) => void;
}

type ChatFilterTab = 'all' | 'event' | 'group' | 'direct';

export const ChatView: React.FC<ChatViewProps> = ({
  initialConversationId,
  onClearInitialConversation,
  onBackToHome,
  onSelectAthlete,
}) => {
  const { userProfile } = useAuth();
  const {
    conversations,
    conversationsLoading,
    groups,
    athletes,
    onlineAthletes,
  } = useOrcaData();

  const [activeTab, setActiveTab] = useState<ChatFilterTab>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedConvId, setSelectedConvId] = useState<string | null>(
    initialConversationId || null
  );

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [sending, setSending] = useState(false);

  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [athleteSearch, setAthleteSearch] = useState('');

  const [groupName, setGroupName] = useState('');
  const [groupSport, setGroupSport] = useState<SportType>('Futebol');
  const [groupDesc, setGroupDesc] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);

  const typingTimeoutRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (initialConversationId) {
      setSelectedConvId(initialConversationId);
      onClearInitialConversation?.();
    }
  }, [initialConversationId, onClearInitialConversation]);

  const athleteMap = useMemo(() => {
    const map = new Map<string, UserPublic>();
    athletes.forEach((a) => map.set(a.uid, a));
    return map;
  }, [athletes]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === selectedConvId) || null,
    [conversations, selectedConvId]
  );

  // Real-time messages listener for the selected conversation
  useEffect(() => {
    if (!activeConversation || !userProfile) {
      setMessages([]);
      return;
    }

    setMessagesLoading(true);
    const q = activeConversation.isOpenChannel
      ? query(
          collection(db, 'conversations', activeConversation.id, 'messages'),
          where('isOpenChannel', '==', true),
          orderBy('createdAt', 'asc'),
          limit(100)
        )
      : query(
          collection(db, 'conversations', activeConversation.id, 'messages'),
          where('memberIds', 'array-contains', userProfile.uid),
          orderBy('createdAt', 'asc'),
          limit(100)
        );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setMessages(snap.docs.map((d) => d.data() as ChatMessage));
        setMessagesLoading(false);
      },
      (err) => {
        setMessagesLoading(false);
        handleFirestoreError(
          err,
          OperationType.LIST,
          `conversations/${activeConversation.id}/messages`
        );
      }
    );

    return () => {
      unsub();
      if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
      void setTypingState(activeConversation.id, userProfile.uid, false);
    };
  }, [activeConversation?.id, activeConversation?.isOpenChannel, userProfile?.uid]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const getConversationDisplay = (conv: Conversation) => {
    if (conv.type === 'direct' && userProfile) {
      const peerId = conv.memberIds.find((id) => id !== userProfile.uid);
      const peer = peerId ? athleteMap.get(peerId) : undefined;
      return {
        title: peer?.displayName || conv.title,
        photoURL: peer?.photoURL || conv.photoURL,
        isOnline: peer?.isOnline === true,
        peer,
      };
    }
    return {
      title: conv.title,
      photoURL: conv.photoURL,
      isOnline: false,
      peer: undefined,
    };
  };

  const filteredConversations = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return conversations.filter((conv) => {
      if (activeTab !== 'all' && conv.type !== activeTab) return false;
      if (!q) return true;
      const disp = getConversationDisplay(conv);
      return (
        disp.title.toLowerCase().includes(q) ||
        (conv.lastMessageText || '').toLowerCase().includes(q)
      );
    });
  }, [conversations, activeTab, searchTerm, athleteMap, userProfile]);

  const discoverableGroups = useMemo(() => {
    if (!userProfile) return [];
    const q = searchTerm.toLowerCase().trim();
    return groups.filter((g) => {
      if (g.memberIds.includes(userProfile.uid)) return false;
      if (!q) return true;
      return (
        g.name.toLowerCase().includes(q) ||
        g.sport.toLowerCase().includes(q)
      );
    });
  }, [groups, userProfile, searchTerm]);

  const handleTypingChange = (val: string) => {
    setDraftText(val);
    if (!activeConversation || !userProfile) return;

    void setTypingState(activeConversation.id, userProfile.uid, val.trim().length > 0);

    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }
    if (val.trim().length > 0) {
      typingTimeoutRef.current = window.setTimeout(() => {
        void setTypingState(activeConversation.id, userProfile.uid, false);
      }, 3000);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversation || !userProfile || !draftText.trim() || sending) return;
    const textToSend = draftText.trim();
    setDraftText('');
    setSending(true);
    try {
      await sendMessage(activeConversation, userProfile, textToSend, 'text');
    } finally {
      setSending(false);
    }
  };

  const handleSendImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversation || !userProfile) return;
    setSending(true);
    try {
      const url = await uploadMediaFile(userProfile.uid, 'chat', file);
      await sendMessage(activeConversation, userProfile, 'Foto enviada', 'image', url);
    } catch {
      // Surface gently without breaking thread
    } finally {
      setSending(false);
      e.target.value = '';
    }
  };

  const handleStartDirect = async (target: UserPublic) => {
    if (!userProfile) return;
    const conv = await startOrGetDirectChat(userProfile, target);
    setShowNewChatModal(false);
    setSelectedConvId(conv.id);
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || groupName.trim().length < 2) return;
    setCreatingGroup(true);
    try {
      const { chatId } = await createSportGroup(
        {
          name: groupName.trim(),
          description: groupDesc.trim(),
          sport: groupSport,
          city: userProfile.city || '',
        },
        userProfile
      );
      setGroupName('');
      setGroupDesc('');
      setShowCreateGroupModal(false);
      setSelectedConvId(chatId);
    } finally {
      setCreatingGroup(false);
    }
  };

  const typingNames = useMemo(() => {
    if (!activeConversation || !userProfile) return [];
    return (activeConversation.typingUserIds || [])
      .filter((id) => id !== userProfile.uid)
      .map((id) => athleteMap.get(id)?.displayName || 'Atleta');
  }, [activeConversation, userProfile, athleteMap]);

  const searchableAthletes = useMemo(() => {
    const q = athleteSearch.toLowerCase().trim();
    return athletes
      .filter((a) => a.uid !== userProfile?.uid)
      .filter(
        (a) =>
          !q ||
          a.displayName.toLowerCase().includes(q) ||
          a.username.toLowerCase().includes(q)
      );
  }, [athletes, userProfile?.uid, athleteSearch]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 lg:pb-8 pt-4 transition-opacity duration-200">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[75vh]">
        {/* Left Column: Conversation List */}
        <div
          className={`lg:col-span-5 xl:col-span-4 flex flex-col gap-4 ${
            selectedConvId ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={onBackToHome}
                aria-label="Voltar para Home"
                className="lg:hidden w-10 h-10 rounded-full bg-white/6 border border-white/10 flex items-center justify-center text-slate-200 cursor-pointer shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="min-w-0">
                <h1 className="text-lg font-display font-extrabold tracking-tight text-white truncate">
                  CONECTA ARENA
                </h1>
                <p className="text-[11px] text-cyan-400 font-medium tracking-wider">
                  MENSAGENS EM TEMPO REAL
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowCreateGroupModal(true)}
                title="Criar grupo esportivo"
                className="px-3 py-2 rounded-xl bg-white/6 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Grupo
              </button>
              <button
                type="button"
                onClick={() => setShowNewChatModal(true)}
                aria-label="Nova conversa"
                className="w-9 h-9 rounded-xl orca-gradient-btn text-white flex items-center justify-center cursor-pointer"
              >
                <MessageSquarePlus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Pesquisar conversas ou atletas..."
              className="w-full pl-10 pr-4 py-3 rounded-2xl bg-[#0D1017] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
            />
          </div>

          {/* Filter Tabs */}
          <div className="grid grid-cols-4 p-1 rounded-2xl bg-[#0D1017] border border-white/8">
            {(
              [
                { id: 'all', label: 'Todas' },
                { id: 'event', label: 'Eventos' },
                { id: 'group', label: 'Grupos' },
                { id: 'direct', label: 'Amigos' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-[#171E2C] text-white border-b-2 border-cyan-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Real Conversations List */}
          <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[55vh] lg:max-h-[60vh] pr-0.5">
            {conversationsLoading ? (
              <ChatListSkeleton />
            ) : filteredConversations.length === 0 ? (
              <div className="rounded-2xl bg-[#0C0F16] border border-white/8 p-6 text-center space-y-3">
                <p className="text-sm font-semibold text-white">
                  Nenhuma conversa ainda
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Entre em um evento, crie um grupo esportivo ou inicie um chat direto com atletas reais da rede.
                </p>
                <button
                  type="button"
                  onClick={() => setShowNewChatModal(true)}
                  className="px-4 py-2.5 rounded-xl orca-gradient-btn text-white text-xs font-semibold cursor-pointer"
                >
                  Conversar com Atleta
                </button>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const disp = getConversationDisplay(conv);
                const isSelected = selectedConvId === conv.id;
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => setSelectedConvId(conv.id)}
                    className={`w-full flex items-center gap-3.5 p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#131926] border-cyan-400/50'
                        : 'bg-[#0C0F16] hover:bg-[#111622] border-white/8'
                    }`}
                  >
                    <UserAvatar
                      name={disp.title}
                      photoURL={disp.photoURL}
                      size="md"
                      isOnline={disp.isOnline}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-white truncate">
                          {disp.title}
                        </span>
                        <span className="text-[11px] font-mono-num text-slate-500 shrink-0">
                          {formatRelativeTimestamp(conv.lastMessageAt)}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 truncate mt-0.5">
                        {conv.lastMessageText || 'Canal aberto — envie a primeira mensagem'}
                      </div>
                    </div>
                  </button>
                );
              })
            )}

            {/* Real Public Groups Discovery */}
            {(activeTab === 'all' || activeTab === 'group') &&
              discoverableGroups.length > 0 && (
                <div className="pt-3 space-y-2">
                  <div className="text-xs font-semibold text-slate-400 px-1">
                    Grupos Públicos para Participar
                  </div>
                  {discoverableGroups.map((g) => (
                    <div
                      key={g.id}
                      className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#0B0E14] border border-white/8"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate">
                          {g.name}
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          {g.sport} · {g.membersCount} membros
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!userProfile) return;
                          await joinSportGroup(g, userProfile);
                          setSelectedConvId(g.chatId);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/30 text-xs font-semibold text-cyan-200 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Entrar
                      </button>
                    </div>
                  ))}
                </div>
              )}
          </div>

          {/* Live Online Counter Footer */}
          <div className="rounded-2xl bg-[#0B0E15] border border-white/8 p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Users className="w-4 h-4 text-cyan-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">
                  Radar Ativo Conecta Sports
                </div>
                <div className="text-[11px] text-slate-400 font-mono-num">
                  {onlineAthletes.length}{' '}
                  {onlineAthletes.length === 1 ? 'atleta online agora' : 'atletas online agora'}
                </div>
              </div>
            </div>
            <div className="flex -space-x-2 shrink-0">
              {onlineAthletes.slice(0, 3).map((a) => (
                <UserAvatar
                  key={a.uid}
                  name={a.displayName}
                  photoURL={a.photoURL}
                  size="xs"
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Active Real-Time Chat Thread */}
        <div
          className={`lg:col-span-7 xl:col-span-8 rounded-3xl bg-[#0B0E15] border border-white/10 flex flex-col overflow-hidden min-h-[70vh] transition-opacity duration-200 ${
            selectedConvId ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {!activeConversation ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-cyan-400">
                <MessageSquarePlus className="w-6 h-6" />
              </div>
              <div className="space-y-1.5 max-w-sm">
                <h2 className="text-lg font-display font-bold text-white">
                  Selecione uma conversa
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Suas mensagens são sincronizadas instantaneamente pelo Firestore em tempo real.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Thread Header */}
              {(() => {
                const disp = getConversationDisplay(activeConversation);
                return (
                  <div className="px-4 sm:px-6 py-4 border-b border-white/8 flex items-center justify-between gap-3 bg-[#0E121B]">
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => setSelectedConvId(null)}
                        aria-label="Voltar às conversas"
                        className="lg:hidden w-9 h-9 rounded-full bg-white/6 flex items-center justify-center text-slate-200 cursor-pointer shrink-0"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (disp.peer) onSelectAthlete(disp.peer);
                        }}
                        className="flex items-center gap-3 min-w-0 text-left cursor-pointer"
                      >
                        <UserAvatar
                          name={disp.title}
                          photoURL={disp.photoURL}
                          size="sm"
                          isOnline={disp.isOnline}
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-display font-bold text-white truncate">
                            {disp.title}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {typingNames.length > 0
                              ? `${typingNames[0]} está digitando...`
                              : activeConversation.type === 'direct'
                              ? disp.isOnline
                                ? 'Online agora'
                                : 'Offline'
                              : `${activeConversation.memberIds.length} participantes`}
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Thread Messages */}
              <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-3 max-h-[55vh] lg:max-h-[58vh]">
                {messagesLoading ? (
                  <div className="flex items-center justify-center py-12 text-slate-400 text-xs gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sincronizando mensagens...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-14 text-xs text-slate-500">
                    Nenhuma mensagem enviada ainda. Diga olá para iniciar a conversa.
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMine = msg.senderId === userProfile?.uid;
                    return (
                      <div
                        key={msg.id}
                        className={`flex items-end gap-2.5 ${
                          isMine ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {!isMine && (
                          <UserAvatar
                            name={msg.senderName}
                            photoURL={msg.senderPhotoURL}
                            size="xs"
                          />
                        )}
                        <div
                          className={`max-w-[78%] sm:max-w-[68%] rounded-2xl px-4 py-2.5 space-y-1.5 ${
                            isMine
                              ? 'bg-gradient-to-br from-rose-500/90 to-pink-600/90 text-white rounded-br-sm'
                              : 'bg-[#141A26] border border-white/8 text-slate-100 rounded-bl-sm'
                          }`}
                        >
                          {!isMine && activeConversation.type !== 'direct' && (
                            <div className="text-[11px] font-semibold text-cyan-300">
                              {msg.senderName}
                            </div>
                          )}
                          {msg.type === 'image' && msg.mediaURL && (
                            <img
                              src={msg.mediaURL}
                              alt="Imagem enviada no chat"
                              className="rounded-xl max-h-56 w-auto object-cover"
                            />
                          )}
                          <p className="text-sm leading-relaxed break-words">
                            {msg.text}
                          </p>
                          <div
                            className={`text-[10px] font-mono-num text-right ${
                              isMine ? 'text-white/75' : 'text-slate-500'
                            }`}
                          >
                            {formatRelativeTimestamp(msg.createdAt)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Composer */}
              <form
                onSubmit={handleSend}
                className="p-3 sm:p-4 border-t border-white/8 bg-[#0E121B] flex items-center gap-2.5"
              >
                <label
                  title="Enviar imagem"
                  className="w-10 h-10 rounded-xl bg-white/6 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-300 cursor-pointer shrink-0"
                >
                  <ImageIcon className="w-4 h-4" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleSendImage}
                    className="hidden"
                  />
                </label>
                <input
                  type="text"
                  maxLength={1000}
                  value={draftText}
                  onChange={(e) => handleTypingChange(e.target.value)}
                  placeholder="Escreva uma mensagem real..."
                  className="flex-1 px-4 py-2.5 rounded-xl bg-[#07090F] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!draftText.trim() || sending}
                  aria-label="Enviar mensagem"
                  className="w-10 h-10 rounded-xl orca-gradient-btn text-white flex items-center justify-center cursor-pointer disabled:opacity-45 shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {/* New Direct Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-3xl bg-[#0E1117] border border-white/10 p-6 space-y-4 max-h-[82vh] flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-display font-bold">Nova Conversa</h3>
              <button
                type="button"
                onClick={() => setShowNewChatModal(false)}
                className="p-2 rounded-full hover:bg-white/10 text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              value={athleteSearch}
              onChange={(e) => setAthleteSearch(e.target.value)}
              placeholder="Buscar atleta pelo nome ou @usuário..."
              className="w-full px-4 py-2.5 rounded-xl bg-[#07090F] border border-white/10 text-sm text-white focus:border-cyan-400 focus:outline-none"
            />
            <div className="flex-1 overflow-y-auto space-y-2">
              {searchableAthletes.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">
                  Nenhum outro atleta cadastrado encontrado com esse filtro.
                </p>
              ) : (
                searchableAthletes.map((a) => (
                  <button
                    key={a.uid}
                    type="button"
                    onClick={() => void handleStartDirect(a)}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl bg-[#121722] hover:bg-[#171E2C] border border-white/8 text-left cursor-pointer"
                  >
                    <UserAvatar
                      name={a.displayName}
                      photoURL={a.photoURL}
                      size="sm"
                      isOnline={a.isOnline}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-white truncate">
                        {a.displayName}
                      </div>
                      <div className="text-xs text-slate-400 truncate">
                        @{a.username}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-3xl bg-[#0E1117] border border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-display font-bold">Criar Grupo Esportivo</h3>
              <button
                type="button"
                onClick={() => setShowCreateGroupModal(false)}
                className="p-2 rounded-full hover:bg-white/10 text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">Nome do grupo</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={60}
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Ex.: Pelada da Zona Sul"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#07090F] border border-white/10 text-sm text-white focus:border-cyan-400 focus:outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">Esporte principal</label>
                <select
                  value={groupSport}
                  onChange={(e) => setGroupSport(e.target.value as SportType)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#07090F] border border-white/10 text-sm text-white focus:border-cyan-400 focus:outline-none"
                >
                  {SPORTS_CATALOG.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">Descrição (opcional)</label>
                <textarea
                  rows={2}
                  maxLength={300}
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  placeholder="Frequência, nível e localização..."
                  className="w-full px-4 py-2.5 rounded-xl bg-[#07090F] border border-white/10 text-sm text-white focus:border-cyan-400 focus:outline-none resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={creatingGroup}
                className="w-full py-3 rounded-xl orca-gradient-btn text-white text-sm font-bold cursor-pointer disabled:opacity-60"
              >
                {creatingGroup ? 'Criando grupo...' : 'Criar Grupo Real'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
