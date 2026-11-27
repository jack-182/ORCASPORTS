import React, { Suspense, useCallback, useState } from 'react';
import { Bell, Home, MessageCircle, Plus, Radio, User, WifiOff } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { OrcaDataProvider, useOrcaData } from './contexts/OrcaDataContext';
import type { AppTab, SportEvent, UserPublic } from './types/orca';
import { AuthScreen } from './components/AuthScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HomeView } from './components/HomeView';
import { OrcaLogo } from './components/OrcaLogo';
import { ViewLoadingFallback } from './components/Skeletons';
import { UserAvatar } from './components/UserAvatar';

// Lazy-loaded feature modules for optimal bundle splitting & fast startup
const RadarView = React.lazy(() =>
  import('./components/RadarView').then((m) => ({ default: m.RadarView }))
);
const ChatView = React.lazy(() =>
  import('./components/ChatView').then((m) => ({ default: m.ChatView }))
);
const ProfileView = React.lazy(() =>
  import('./components/ProfileView').then((m) => ({ default: m.ProfileView }))
);
const CreateEventModal = React.lazy(() =>
  import('./components/CreateEventModal').then((m) => ({
    default: m.CreateEventModal,
  }))
);
const EventDetailModal = React.lazy(() =>
  import('./components/EventDetailModal').then((m) => ({
    default: m.EventDetailModal,
  }))
);
const AthleteProfileModal = React.lazy(() =>
  import('./components/AthleteProfileModal').then((m) => ({
    default: m.AthleteProfileModal,
  }))
);
const NotificationsDrawer = React.lazy(() =>
  import('./components/NotificationsDrawer').then((m) => ({
    default: m.NotificationsDrawer,
  }))
);

const AuthenticatedShell: React.FC = () => {
  const { userProfile, isNetworkOnline } = useAuth();
  const { unreadNotificationsCount, eventsFromCache, conversationsFromCache } =
    useOrcaData();

  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<SportEvent | null>(null);
  const [selectedAthlete, setSelectedAthlete] = useState<UserPublic | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [pendingChatId, setPendingChatId] = useState<string | null>(null);

  const openChatThread = useCallback((chatId: string) => {
    setPendingChatId(chatId);
    setActiveTab('chat');
  }, []);

  const clearPendingChat = useCallback(() => {
    setPendingChatId(null);
  }, []);

  const handleBackToHome = useCallback(() => {
    setActiveTab('home');
  }, []);

  return (
    <div className="min-h-screen bg-[#06070B] text-slate-100 flex flex-col">
      {/* Desktop Top Bar (3-zone contract: Wordmark | Nav Links | Primary Action) */}
      <header className="hidden lg:block sticky top-0 z-30 bg-[#06070B]/88 backdrop-blur-md border-b border-white/8">
        <div className="max-w-7xl mx-auto px-8 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="cursor-pointer shrink-0"
          >
            <OrcaLogo size="sm" />
          </button>

          <nav className="flex items-center gap-8 text-sm font-medium">
            {(
              [
                { id: 'home', label: 'Home' },
                { id: 'radar', label: 'Radar' },
                { id: 'chat', label: 'Chat' },
                { id: 'profile', label: 'Perfil' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
                  activeTab === item.id
                    ? 'text-white border-cyan-400 font-semibold'
                    : 'text-slate-400 border-transparent hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setShowNotifications(true)}
              aria-label="Notificações"
              className="relative w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-200 cursor-pointer"
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
              onClick={() => setShowCreateEvent(true)}
              className="px-4 py-2 rounded-xl orca-gradient-btn text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Criar Evento
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('profile')}
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
      </header>

      {/* Main Content with smooth fade transition (prevents white screen on chat exit) */}
      <main className="flex-1">
        {!isNetworkOnline && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3">
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-amber-500/10 border border-amber-400/25 text-xs text-amber-200">
              <div className="flex items-center gap-2 min-w-0">
                <WifiOff className="w-4 h-4 text-amber-300 shrink-0" />
                <span className="truncate">
                  Sem conexão com a internet — exibindo eventos e histórico de chat salvos em cache
                  {eventsFromCache || conversationsFromCache ? ' (offline)' : ''}.
                </span>
              </div>
            </div>
          </div>
        )}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            {activeTab === 'home' && (
              <HomeView
                onOpenCreateEvent={() => setShowCreateEvent(true)}
                onNavigateTab={setActiveTab}
                onSelectEvent={setSelectedEvent}
                onSelectAthlete={setSelectedAthlete}
                onOpenNotifications={() => setShowNotifications(true)}
              />
            )}

            {activeTab === 'radar' && (
              <Suspense fallback={<ViewLoadingFallback />}>
                <RadarView
                  onOpenCreateEvent={() => setShowCreateEvent(true)}
                  onSelectEvent={setSelectedEvent}
                  onSelectAthlete={setSelectedAthlete}
                />
              </Suspense>
            )}

            {activeTab === 'chat' && (
              <Suspense fallback={<ViewLoadingFallback />}>
                <ChatView
                  initialConversationId={pendingChatId}
                  onClearInitialConversation={clearPendingChat}
                  onBackToHome={handleBackToHome}
                  onSelectAthlete={setSelectedAthlete}
                />
              </Suspense>
            )}

            {activeTab === 'profile' && (
              <Suspense fallback={<ViewLoadingFallback />}>
                <ProfileView
                  onSelectEvent={setSelectedEvent}
                  onSelectAthlete={setSelectedAthlete}
                />
              </Suspense>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile Bottom Tab Bar (<= 15% sticky viewport cap) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#080A10]/95 backdrop-blur-md border-t border-white/10 pb-safe">
        <div className="grid grid-cols-5 items-center h-16 px-2">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center justify-center gap-1 min-h-[44px] cursor-pointer ${
              activeTab === 'home' ? 'text-white' : 'text-slate-500'
            }`}
          >
            <Home className={`w-5 h-5 ${activeTab === 'home' ? 'text-rose-400' : ''}`} />
            <span className="text-[10px] font-medium">Home</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('radar')}
            className={`flex flex-col items-center justify-center gap-1 min-h-[44px] cursor-pointer ${
              activeTab === 'radar' ? 'text-white' : 'text-slate-500'
            }`}
          >
            <Radio className={`w-5 h-5 ${activeTab === 'radar' ? 'text-cyan-400' : ''}`} />
            <span className="text-[10px] font-medium">Radar</span>
          </button>

          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={() => setShowCreateEvent(true)}
              aria-label="Criar Evento"
              className="w-12 h-12 -mt-4 rounded-full orca-gradient-btn text-white flex items-center justify-center shadow-lg shadow-rose-500/25 border-4 border-[#06070B] cursor-pointer"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`flex flex-col items-center justify-center gap-1 min-h-[44px] cursor-pointer ${
              activeTab === 'chat' ? 'text-white' : 'text-slate-500'
            }`}
          >
            <MessageCircle
              className={`w-5 h-5 ${activeTab === 'chat' ? 'text-cyan-400' : ''}`}
            />
            <span className="text-[10px] font-medium">Chat</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center justify-center gap-1 min-h-[44px] cursor-pointer ${
              activeTab === 'profile' ? 'text-white' : 'text-slate-500'
            }`}
          >
            <User className={`w-5 h-5 ${activeTab === 'profile' ? 'text-rose-400' : ''}`} />
            <span className="text-[10px] font-medium">Perfil</span>
          </button>
        </div>
      </nav>

      {/* Lazy Modals & Drawers */}
      <Suspense fallback={null}>
        {showCreateEvent && (
          <CreateEventModal
            isOpen={showCreateEvent}
            onClose={() => setShowCreateEvent(false)}
            onCreated={() => {
              setActiveTab('home');
            }}
          />
        )}

        {selectedEvent && (
          <EventDetailModal
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
            onOpenChat={openChatThread}
          />
        )}

        {selectedAthlete && (
          <AthleteProfileModal
            athlete={selectedAthlete}
            onClose={() => setSelectedAthlete(null)}
            onOpenChat={openChatThread}
          />
        )}

        {showNotifications && (
          <NotificationsDrawer
            isOpen={showNotifications}
            onClose={() => setShowNotifications(false)}
          />
        )}
      </Suspense>
    </div>
  );
};

const RootRouter: React.FC = () => {
  const { authReady, firebaseUser } = useAuth();

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#06070B] flex flex-col items-center justify-center gap-4">
        <OrcaLogo size="md" showTagline />
        <div className="w-36 h-1 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full w-1/2 bg-gradient-to-r from-rose-500 to-cyan-400 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    return <AuthScreen />;
  }

  return (
    <OrcaDataProvider>
      <AuthenticatedShell />
    </OrcaDataProvider>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <RootRouter />
      </AuthProvider>
    </ErrorBoundary>
  );
}
