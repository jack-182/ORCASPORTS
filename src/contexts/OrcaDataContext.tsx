import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { fetchUserJoinedEventIds } from '../services/firestoreService';
import type {
  AppNotification,
  Conversation,
  Friendship,
  SportEvent,
  SportGroup,
  UserPublic,
} from '../types/orca';
import { useAuth } from './AuthContext';

interface OrcaDataContextValue {
  events: SportEvent[];
  eventsLoading: boolean;
  athletes: UserPublic[];
  athletesLoading: boolean;
  onlineAthletes: UserPublic[];
  conversations: Conversation[];
  conversationsLoading: boolean;
  groups: SportGroup[];
  groupsLoading: boolean;
  friendships: Friendship[];
  notifications: AppNotification[];
  unreadNotificationsCount: number;
  joinedEventIds: string[];
  refreshJoinedEvents: () => Promise<void>;
}

const OrcaDataContext = createContext<OrcaDataContextValue | null>(null);

export const OrcaDataProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { authReady, firebaseUser, emailVerified } = useAuth();

  const [events, setEvents] = useState<SportEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  const [athletes, setAthletes] = useState<UserPublic[]>([]);
  const [athletesLoading, setAthletesLoading] = useState(true);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);

  const [groups, setGroups] = useState<SportGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);

  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [joinedEventIds, setJoinedEventIds] = useState<string[]>([]);

  const uid = firebaseUser?.uid;
  const ready = authReady && Boolean(uid) && emailVerified;

  const refreshJoinedEvents = useCallback(async () => {
    if (!uid || !emailVerified) return;
    try {
      const ids = await fetchUserJoinedEventIds(uid);
      setJoinedEventIds(ids);
    } catch (err) {
      console.warn('Error refreshing joined events:', err);
    }
  }, [uid, emailVerified]);

  useEffect(() => {
    if (!ready || !uid) {
      setEvents([]);
      setAthletes([]);
      setConversations([]);
      setGroups([]);
      setFriendships([]);
      setNotifications([]);
      setJoinedEventIds([]);
      setEventsLoading(false);
      setAthletesLoading(false);
      setConversationsLoading(false);
      setGroupsLoading(false);
      return;
    }

    setEventsLoading(true);
    setAthletesLoading(true);
    setConversationsLoading(true);
    setGroupsLoading(true);

    const eventsQ = query(
      collection(db, 'events'),
      where('status', '==', 'active'),
      orderBy('startsAtMs', 'asc'),
      limit(60)
    );
    const unsubEvents = onSnapshot(
      eventsQ,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as SportEvent);
        setEvents(list);
        setEventsLoading(false);
        void fetchUserJoinedEventIds(uid).then(setJoinedEventIds).catch(() => undefined);
      },
      (err) => {
        setEventsLoading(false);
        handleFirestoreError(err, OperationType.LIST, 'events');
      }
    );

    const athletesQ = query(
      collection(db, 'users'),
      where('discoverable', '==', true),
      limit(80)
    );
    const unsubAthletes = onSnapshot(
      athletesQ,
      (snap) => {
        setAthletes(snap.docs.map((d) => d.data() as UserPublic));
        setAthletesLoading(false);
      },
      (err) => {
        setAthletesLoading(false);
        handleFirestoreError(err, OperationType.LIST, 'users');
      }
    );

    const convQ = query(
      collection(db, 'conversations'),
      where('memberIds', 'array-contains', uid),
      limit(50)
    );
    const unsubConvs = onSnapshot(
      convQ,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Conversation);
        list.sort((a, b) => {
          const aTime = a.lastMessageAt?.toMillis?.() || a.updatedAt?.toMillis?.() || 0;
          const bTime = b.lastMessageAt?.toMillis?.() || b.updatedAt?.toMillis?.() || 0;
          return bTime - aTime;
        });
        setConversations(list);
        setConversationsLoading(false);
      },
      (err) => {
        setConversationsLoading(false);
        handleFirestoreError(err, OperationType.LIST, 'conversations');
      }
    );

    const groupsQ = query(
      collection(db, 'groups'),
      where('isPublic', '==', true),
      limit(40)
    );
    const unsubGroups = onSnapshot(
      groupsQ,
      (snap) => {
        setGroups(snap.docs.map((d) => d.data() as SportGroup));
        setGroupsLoading(false);
      },
      (err) => {
        setGroupsLoading(false);
        handleFirestoreError(err, OperationType.LIST, 'groups');
      }
    );

    const friendsQ = query(
      collection(db, 'friendships'),
      where('users', 'array-contains', uid),
      limit(80)
    );
    const unsubFriends = onSnapshot(
      friendsQ,
      (snap) => {
        setFriendships(snap.docs.map((d) => d.data() as Friendship));
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'friendships');
      }
    );

    const notifsQ = query(
      collection(db, 'notifications'),
      where('recipientId', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(30)
    );
    const unsubNotifs = onSnapshot(
      notifsQ,
      (snap) => {
        setNotifications(snap.docs.map((d) => d.data() as AppNotification));
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'notifications');
      }
    );

    return () => {
      unsubEvents();
      unsubAthletes();
      unsubConvs();
      unsubGroups();
      unsubFriends();
      unsubNotifs();
    };
  }, [ready, uid]);

  const onlineAthletes = useMemo(() => {
    const staleThresholdMs = 3 * 60 * 1000;
    const now = Date.now();
    return athletes.filter((a) => {
      if (!a.isOnline) return false;
      const seenMs = a.lastSeen?.toMillis?.();
      if (seenMs && now - seenMs > staleThresholdMs) return false;
      return true;
    });
  }, [athletes]);

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const value = useMemo<OrcaDataContextValue>(
    () => ({
      events,
      eventsLoading,
      athletes,
      athletesLoading,
      onlineAthletes,
      conversations,
      conversationsLoading,
      groups,
      groupsLoading,
      friendships,
      notifications,
      unreadNotificationsCount,
      joinedEventIds,
      refreshJoinedEvents,
    }),
    [
      events,
      eventsLoading,
      athletes,
      athletesLoading,
      onlineAthletes,
      conversations,
      conversationsLoading,
      groups,
      groupsLoading,
      friendships,
      notifications,
      unreadNotificationsCount,
      joinedEventIds,
      refreshJoinedEvents,
    ]
  );

  return (
    <OrcaDataContext.Provider value={value}>{children}</OrcaDataContext.Provider>
  );
};

export function useOrcaData(): OrcaDataContextValue {
  const ctx = useContext(OrcaDataContext);
  if (!ctx) throw new Error('useOrcaData must be used inside OrcaDataProvider');
  return ctx;
}
