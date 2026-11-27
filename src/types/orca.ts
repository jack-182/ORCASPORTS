import type { Timestamp } from 'firebase/firestore';

export type SportType =
  | 'Futebol'
  | 'Basquete'
  | 'Vôlei'
  | 'Corrida'
  | 'Tênis'
  | 'Beach Tennis'
  | 'Ciclismo'
  | 'Funcional';

export type SkillLevel = 'Iniciante' | 'Intermediário' | 'Avançado' | 'Todos';

export type AppTab = 'home' | 'radar' | 'chat' | 'profile';

export interface GeoCoordinates {
  lat: number;
  lng: number;
  accuracy?: number;
  updatedAtMs?: number;
}

export interface UserPublic {
  uid: string;
  displayName: string;
  username: string;
  photoURL?: string;
  bannerURL?: string;
  bio?: string;
  city?: string;
  favoriteSports?: SportType[];
  xp: number;
  matchesCount: number;
  eventsHostedCount: number;
  reputationSum?: number;
  reputationCount?: number;
  followersCount?: number;
  followingCount?: number;
  isOnline: boolean;
  lastSeen?: Timestamp | null;
  lat?: number;
  lng?: number;
  shareLocation: boolean;
  discoverable: boolean;
  verified: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface UserPrivate {
  uid: string;
  email: string;
  preferredRadiusKm: number;
  notificationsEnabled: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface SportEvent {
  id: string;
  hostId: string;
  hostName: string;
  hostPhotoURL?: string;
  title: string;
  description?: string;
  sport: SportType;
  level: SkillLevel;
  venueName: string;
  address?: string;
  city?: string;
  lat: number;
  lng: number;
  startsAtMs: number;
  durationMinutes: number;
  price: number;
  maxParticipants: number;
  participantsCount: number;
  coverURL?: string;
  status: 'active' | 'cancelled' | 'completed';
  chatId: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface EventParticipant {
  uid: string;
  displayName: string;
  photoURL?: string;
  role: 'host' | 'player';
  joinedAt?: Timestamp | null;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group' | 'event';
  title: string;
  sport?: string;
  photoURL?: string;
  eventId?: string;
  groupId?: string;
  createdBy: string;
  memberIds: string[];
  isOpenChannel: boolean;
  lastMessageText?: string;
  lastMessageSenderId?: string;
  lastMessageSenderName?: string;
  lastMessageAt?: Timestamp | null;
  typingUserIds: string[];
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderPhotoURL?: string;
  text: string;
  type: 'text' | 'image' | 'system';
  mediaURL?: string;
  memberIds: string[];
  isOpenChannel: boolean;
  createdAt?: Timestamp | null;
}

export interface SportGroup {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  sport: SportType;
  city?: string;
  photoURL?: string;
  memberIds: string[];
  membersCount: number;
  chatId: string;
  isPublic: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface Friendship {
  id: string;
  users: string[];
  requesterId: string;
  recipientId: string;
  status: 'pending' | 'accepted';
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface AppNotification {
  id: string;
  recipientId: string;
  senderId: string;
  senderName: string;
  type: 'event_join' | 'friend_request' | 'friend_accepted' | 'message' | 'group_join';
  title: string;
  body: string;
  relatedId?: string;
  read: boolean;
  createdAt?: Timestamp | null;
}

export interface AchievementItem {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  progressLabel: string;
  tier: 'bronze' | 'silver' | 'gold' | 'cyan';
}
