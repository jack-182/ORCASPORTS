import React from 'react';
import { Bell, CheckCheck, X } from 'lucide-react';
import { useOrcaData } from '../contexts/OrcaDataContext';
import { markNotificationRead } from '../services/firestoreService';
import { formatRelativeTimestamp } from '../utils/sports';

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const { notifications, unreadNotificationsCount } = useOrcaData();

  if (!isOpen) return null;

  const markAllRead = async () => {
    await Promise.all(
      notifications
        .filter((n) => !n.read)
        .map((n) => markNotificationRead(n.id).catch(() => undefined))
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-md bg-[#0B0E15] border-l border-white/10 h-full flex flex-col">
        <div className="p-5 border-b border-white/8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-cyan-400" />
            <h2 className="text-base font-display font-bold">Notificações</h2>
            {unreadNotificationsCount > 0 && (
              <span className="text-xs font-mono-num text-rose-400">
                ({unreadNotificationsCount})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadNotificationsCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs text-cyan-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Limpar
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 text-slate-400 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {notifications.length === 0 ? (
            <div className="text-center py-14 space-y-2">
              <p className="text-sm font-semibold text-white">Tudo em dia</p>
              <p className="text-xs text-slate-400">
                Suas notificações reais de eventos e amizades aparecerão aqui.
              </p>
            </div>
          ) : (
            notifications.map((notif) => (
              <button
                key={notif.id}
                type="button"
                onClick={() => {
                  if (!notif.read) void markNotificationRead(notif.id);
                }}
                className={`w-full text-left p-4 rounded-2xl border transition-colors cursor-pointer ${
                  notif.read
                    ? 'bg-[#0E1118] border-white/6 opacity-70'
                    : 'bg-[#121824] border-cyan-400/35'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white">
                    {notif.title}
                  </span>
                  <span className="text-[11px] font-mono-num text-slate-500">
                    {formatRelativeTimestamp(notif.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  {notif.body}
                </p>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
