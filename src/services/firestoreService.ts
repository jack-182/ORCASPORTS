import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, handleFirestoreError, OperationType, storage } from '../lib/firebase';
import type {
  Conversation,
  GeoCoordinates,
  SkillLevel,
  SportEvent,
  SportGroup,
  SportType,
  UserPublic,
} from '../types/orca';
import { compressImageFile, getSportMeta, sanitizeUsername } from '../utils/sports';

function clampString(value: string | undefined | null, maxLen: number): string {
  if (!value) return '';
  return value.trim().slice(0, maxLen);
}

export async function syncUserOnSignIn(
  fbUser: FirebaseUser,
  preferredDisplayName?: string
): Promise<void> {
  const userRef = doc(db, 'users', fbUser.uid);
  const privateRef = doc(db, 'users_private', fbUser.uid);

  let existingSnap;
  try {
    existingSnap = await getDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${fbUser.uid}`);
  }

  const rawName =
    preferredDisplayName?.trim() ||
    fbUser.displayName?.trim() ||
    fbUser.email?.split('@')[0] ||
    'Atleta';
  const safeName = rawName.length >= 2 ? rawName.slice(0, 60) : `${rawName}_atleta`.slice(0, 60);

  if (!existingSnap.exists()) {
    const baseUsername = sanitizeUsername(
      fbUser.email?.split('@')[0] || safeName
    );
    const uniqueUsername = `${baseUsername.slice(0, 20)}_${fbUser.uid.slice(0, 4).toLowerCase()}`;

    const newPublicProfile = {
      uid: fbUser.uid,
      displayName: safeName,
      username: uniqueUsername,
      photoURL: clampString(fbUser.photoURL, 1024),
      bannerURL: '',
      bio: '',
      city: '',
      favoriteSports: [] as SportType[],
      xp: 0,
      matchesCount: 0,
      eventsHostedCount: 0,
      reputationSum: 0,
      reputationCount: 0,
      followersCount: 0,
      followingCount: 0,
      isOnline: true,
      lastSeen: serverTimestamp(),
      shareLocation: true,
      discoverable: true,
      verified: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const newPrivateProfile = {
      uid: fbUser.uid,
      email: clampString(fbUser.email || `${fbUser.uid}@orca.app`, 160),
      preferredRadiusKm: 25,
      notificationsEnabled: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const batch = writeBatch(db);
    batch.set(userRef, newPublicProfile);
    batch.set(privateRef, newPrivateProfile);
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${fbUser.uid}`);
    }
  } else {
    try {
      await updateDoc(userRef, {
        isOnline: true,
        lastSeen: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${fbUser.uid}`);
    }
  }
}

export async function updateOnlinePresence(
  uid: string,
  isOnline: boolean,
  coords?: GeoCoordinates | null
): Promise<void> {
  const userRef = doc(db, 'users', uid);
  const payload: Record<string, unknown> = {
    isOnline,
    lastSeen: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (
    coords &&
    Number.isFinite(coords.lat) &&
    Number.isFinite(coords.lng) &&
    coords.lat >= -90 &&
    coords.lat <= 90 &&
    coords.lng >= -180 &&
    coords.lng <= 180
  ) {
    payload.lat = Number(coords.lat.toFixed(6));
    payload.lng = Number(coords.lng.toFixed(6));
  }

  try {
    await updateDoc(userRef, payload);
  } catch (error) {
    // Presence updates on unload can race with auth teardown; log cleanly without crashing UI
    console.warn('Presence sync warning:', error);
  }
}

export async function updateUserProfile(
  uid: string,
  updates: Partial<{
    displayName: string;
    username: string;
    bio: string;
    city: string;
    photoURL: string;
    bannerURL: string;
    favoriteSports: SportType[];
    shareLocation: boolean;
    discoverable: boolean;
  }>
): Promise<void> {
  const userRef = doc(db, 'users', uid);
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (updates.displayName !== undefined) {
    const clean = clampString(updates.displayName, 60);
    if (clean.length < 2) throw new Error('Nome deve ter pelo menos 2 caracteres.');
    payload.displayName = clean;
  }
  if (updates.username !== undefined) {
    const clean = sanitizeUsername(updates.username);
    payload.username = clean;
  }
  if (updates.bio !== undefined) payload.bio = clampString(updates.bio, 240);
  if (updates.city !== undefined) payload.city = clampString(updates.city, 80);
  if (updates.photoURL !== undefined) payload.photoURL = clampString(updates.photoURL, 1024);
  if (updates.bannerURL !== undefined) payload.bannerURL = clampString(updates.bannerURL, 1024);
  if (updates.favoriteSports !== undefined) {
    payload.favoriteSports = updates.favoriteSports.slice(0, 8);
  }
  if (updates.shareLocation !== undefined) payload.shareLocation = Boolean(updates.shareLocation);
  if (updates.discoverable !== undefined) payload.discoverable = Boolean(updates.discoverable);

  try {
    await updateDoc(userRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function updateUserPrivatePrefs(
  uid: string,
  updates: Partial<{ preferredRadiusKm: number; notificationsEnabled: boolean }>
): Promise<void> {
  const privateRef = doc(db, 'users_private', uid);
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (updates.preferredRadiusKm !== undefined) {
    payload.preferredRadiusKm = Math.max(1, Math.min(500, Math.round(updates.preferredRadiusKm)));
  }
  if (updates.notificationsEnabled !== undefined) {
    payload.notificationsEnabled = Boolean(updates.notificationsEnabled);
  }
  try {
    await updateDoc(privateRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users_private/${uid}`);
  }
}

export async function uploadMediaFile(
  uid: string,
  folder: 'avatars' | 'banners' | 'events' | 'chat',
  file: File
): Promise<string> {
  if (file.size > 8 * 1024 * 1024) {
    throw new Error('A imagem deve ter no máximo 8 MB.');
  }
  const compressed = await compressImageFile(
    file,
    folder === 'avatars' ? 600 : 1280,
    folder === 'avatars' ? 600 : 960,
    0.82
  );
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.webp`;
  const storageRef = ref(storage, `orca/${folder}/${uid}/${fileName}`);
  await uploadBytes(storageRef, compressed, {
    contentType: 'image/webp',
    cacheControl: 'public, max-age=31536000',
  });
  return await getDownloadURL(storageRef);
}

export interface CreateEventInput {
  title: string;
  description: string;
  sport: SportType;
  level: SkillLevel;
  venueName: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  startsAtMs: number;
  durationMinutes: number;
  price: number;
  maxParticipants: number;
  coverURL?: string;
}

export async function createSportEvent(
  input: CreateEventInput,
  host: UserPublic
): Promise<{ eventId: string; chatId: string }> {
  const eventRef = doc(collection(db, 'events'));
  const chatRef = doc(collection(db, 'conversations'));
  const participantRef = doc(db, 'events', eventRef.id, 'participants', host.uid);
  const hostRef = doc(db, 'users', host.uid);

  const sportMeta = getSportMeta(input.sport);
  const coverURL = clampString(input.coverURL || sportMeta.coverURL, 1024);

  const batch = writeBatch(db);

  batch.set(eventRef, {
    id: eventRef.id,
    hostId: host.uid,
    hostName: clampString(host.displayName, 60),
    hostPhotoURL: clampString(host.photoURL, 1024),
    title: clampString(input.title, 80),
    description: clampString(input.description, 600),
    sport: input.sport,
    level: input.level,
    venueName: clampString(input.venueName, 100),
    address: clampString(input.address, 160),
    city: clampString(input.city, 80),
    lat: Number(input.lat.toFixed(6)),
    lng: Number(input.lng.toFixed(6)),
    startsAtMs: input.startsAtMs,
    durationMinutes: Math.max(15, Math.min(480, Math.round(input.durationMinutes))),
    price: Math.max(0, Number(input.price) || 0),
    maxParticipants: Math.max(2, Math.min(200, Math.round(input.maxParticipants))),
    participantsCount: 1,
    coverURL,
    status: 'active',
    chatId: chatRef.id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(participantRef, {
    uid: host.uid,
    displayName: clampString(host.displayName, 60),
    photoURL: clampString(host.photoURL, 1024),
    role: 'host',
    joinedAt: serverTimestamp(),
  });

  batch.set(chatRef, {
    id: chatRef.id,
    type: 'event',
    title: clampString(input.title, 80),
    sport: input.sport,
    photoURL: coverURL,
    eventId: eventRef.id,
    createdBy: host.uid,
    memberIds: [host.uid],
    isOpenChannel: true,
    lastMessageText: `Evento "${clampString(input.title, 50)}" criado!`,
    lastMessageSenderId: host.uid,
    lastMessageSenderName: clampString(host.displayName, 60),
    lastMessageAt: serverTimestamp(),
    typingUserIds: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.update(hostRef, {
    eventsHostedCount: increment(1),
    xp: increment(120),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `events/${eventRef.id}`);
  }

  return { eventId: eventRef.id, chatId: chatRef.id };
}

export async function joinSportEvent(
  event: SportEvent,
  user: UserPublic
): Promise<void> {
  if (event.participantsCount >= event.maxParticipants) {
    throw new Error('Este evento já atingiu o limite máximo de participantes.');
  }

  const eventRef = doc(db, 'events', event.id);
  const participantRef = doc(db, 'events', event.id, 'participants', user.uid);
  const chatRef = doc(db, 'conversations', event.chatId);
  const userRef = doc(db, 'users', user.uid);

  const existingParticipant = await getDoc(participantRef);
  if (existingParticipant.exists()) return;

  const batch = writeBatch(db);

  batch.set(participantRef, {
    uid: user.uid,
    displayName: clampString(user.displayName, 60),
    photoURL: clampString(user.photoURL, 1024),
    role: 'player',
    joinedAt: serverTimestamp(),
  });

  batch.update(eventRef, {
    participantsCount: increment(1),
    updatedAt: serverTimestamp(),
  });

  batch.update(chatRef, {
    memberIds: arrayUnion(user.uid),
    updatedAt: serverTimestamp(),
  });

  batch.update(userRef, {
    matchesCount: increment(1),
    xp: increment(50),
    updatedAt: serverTimestamp(),
  });

  if (event.hostId !== user.uid) {
    const notifRef = doc(collection(db, 'notifications'));
    batch.set(notifRef, {
      id: notifRef.id,
      recipientId: event.hostId,
      senderId: user.uid,
      senderName: clampString(user.displayName, 60),
      type: 'event_join',
      title: 'Novo atleta confirmado',
      body: `${clampString(user.displayName, 40)} entrou em "${clampString(event.title, 40)}".`,
      relatedId: event.id,
      read: false,
      createdAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `events/${event.id}/participants/${user.uid}`);
  }
}

export async function leaveSportEvent(
  event: SportEvent,
  user: UserPublic
): Promise<void> {
  if (event.hostId === user.uid) {
    throw new Error('O anfitrião não pode sair do próprio evento. Você pode cancelá-lo.');
  }
  const eventRef = doc(db, 'events', event.id);
  const participantRef = doc(db, 'events', event.id, 'participants', user.uid);
  const chatRef = doc(db, 'conversations', event.chatId);

  const batch = writeBatch(db);
  batch.delete(participantRef);
  batch.update(eventRef, {
    participantsCount: increment(-1),
    updatedAt: serverTimestamp(),
  });
  batch.update(chatRef, {
    memberIds: arrayRemove(user.uid),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `events/${event.id}/participants/${user.uid}`);
  }
}

export async function cancelSportEvent(eventId: string): Promise<void> {
  const eventRef = doc(db, 'events', eventId);
  try {
    await updateDoc(eventRef, {
      status: 'cancelled',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `events/${eventId}`);
  }
}

export async function createSportGroup(
  input: { name: string; description: string; sport: SportType; city: string },
  owner: UserPublic
): Promise<{ groupId: string; chatId: string }> {
  const groupRef = doc(collection(db, 'groups'));
  const chatRef = doc(collection(db, 'conversations'));
  const sportMeta = getSportMeta(input.sport);

  const batch = writeBatch(db);
  batch.set(groupRef, {
    id: groupRef.id,
    ownerId: owner.uid,
    name: clampString(input.name, 60),
    description: clampString(input.description, 300),
    sport: input.sport,
    city: clampString(input.city, 80),
    photoURL: sportMeta.coverURL,
    memberIds: [owner.uid],
    membersCount: 1,
    chatId: chatRef.id,
    isPublic: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(chatRef, {
    id: chatRef.id,
    type: 'group',
    title: clampString(input.name, 80),
    sport: input.sport,
    photoURL: sportMeta.coverURL,
    groupId: groupRef.id,
    createdBy: owner.uid,
    memberIds: [owner.uid],
    isOpenChannel: true,
    lastMessageText: `Grupo "${clampString(input.name, 50)}" criado!`,
    lastMessageSenderId: owner.uid,
    lastMessageSenderName: clampString(owner.displayName, 60),
    lastMessageAt: serverTimestamp(),
    typingUserIds: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `groups/${groupRef.id}`);
  }

  return { groupId: groupRef.id, chatId: chatRef.id };
}

export async function joinSportGroup(
  group: SportGroup,
  user: UserPublic
): Promise<void> {
  if (group.memberIds.includes(user.uid)) return;
  const groupRef = doc(db, 'groups', group.id);
  const chatRef = doc(db, 'conversations', group.chatId);

  const batch = writeBatch(db);
  batch.update(groupRef, {
    memberIds: arrayUnion(user.uid),
    membersCount: increment(1),
    updatedAt: serverTimestamp(),
  });
  batch.update(chatRef, {
    memberIds: arrayUnion(user.uid),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `groups/${group.id}`);
  }
}

export async function startOrGetDirectChat(
  currentUser: UserPublic,
  targetUser: UserPublic
): Promise<Conversation> {
  const sorted = [currentUser.uid, targetUser.uid].sort();
  const convId = `dm_${sorted[0]}_${sorted[1]}`;
  const convRef = doc(db, 'conversations', convId);

  try {
    const existing = await getDoc(convRef);
    if (existing.exists()) {
      return existing.data() as Conversation;
    }

    const newConv = {
      id: convId,
      type: 'direct' as const,
      title: clampString(targetUser.displayName, 80),
      photoURL: clampString(targetUser.photoURL, 1024),
      createdBy: currentUser.uid,
      memberIds: sorted,
      isOpenChannel: false,
      lastMessageText: '',
      typingUserIds: [] as string[],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(convRef, newConv);
    const createdSnap = await getDoc(convRef);
    return createdSnap.data() as Conversation;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `conversations/${convId}`);
  }
}

export async function sendMessage(
  conversation: Conversation,
  sender: UserPublic,
  text: string,
  type: 'text' | 'image' | 'system' = 'text',
  mediaURL?: string
): Promise<void> {
  const cleanText = clampString(text, 1000);
  if (!cleanText && !mediaURL) return;

  const msgRef = doc(collection(db, 'conversations', conversation.id, 'messages'));
  const convRef = doc(db, 'conversations', conversation.id);

  const batch = writeBatch(db);
  batch.set(msgRef, {
    id: msgRef.id,
    senderId: sender.uid,
    senderName: clampString(sender.displayName, 60),
    senderPhotoURL: clampString(sender.photoURL, 1024),
    text: cleanText || 'Imagem enviada',
    type,
    mediaURL: clampString(mediaURL, 1024),
    memberIds: conversation.memberIds,
    isOpenChannel: conversation.isOpenChannel,
    createdAt: serverTimestamp(),
  });

  batch.update(convRef, {
    lastMessageText: clampString(cleanText || 'Imagem enviada', 300),
    lastMessageSenderId: sender.uid,
    lastMessageSenderName: clampString(sender.displayName, 60),
    lastMessageAt: serverTimestamp(),
    typingUserIds: arrayRemove(sender.uid),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `conversations/${conversation.id}/messages/${msgRef.id}`
    );
  }
}

export async function setTypingState(
  convId: string,
  uid: string,
  isTyping: boolean
): Promise<void> {
  const convRef = doc(db, 'conversations', convId);
  try {
    await updateDoc(convRef, {
      typingUserIds: isTyping ? arrayUnion(uid) : arrayRemove(uid),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Typing indicator is ephemeral; silently ignore transient conflicts
  }
}

export function getFriendshipId(uidA: string, uidB: string): string {
  const [a, b] = [uidA, uidB].sort();
  return `${a}_${b}`;
}

export async function sendFriendRequest(
  currentUser: UserPublic,
  targetUser: UserPublic
): Promise<void> {
  const friendshipId = getFriendshipId(currentUser.uid, targetUser.uid);
  const fRef = doc(db, 'friendships', friendshipId);
  const notifRef = doc(collection(db, 'notifications'));

  const batch = writeBatch(db);
  batch.set(fRef, {
    id: friendshipId,
    users: [currentUser.uid, targetUser.uid].sort(),
    requesterId: currentUser.uid,
    recipientId: targetUser.uid,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(notifRef, {
    id: notifRef.id,
    recipientId: targetUser.uid,
    senderId: currentUser.uid,
    senderName: clampString(currentUser.displayName, 60),
    type: 'friend_request',
    title: 'Novo pedido de amizade',
    body: `${clampString(currentUser.displayName, 40)} quer se conectar com você no ORCA.`,
    relatedId: friendshipId,
    read: false,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `friendships/${friendshipId}`);
  }
}

export async function acceptFriendRequest(
  friendshipId: string,
  requesterId: string,
  currentUser: UserPublic
): Promise<void> {
  const fRef = doc(db, 'friendships', friendshipId);
  const notifRef = doc(collection(db, 'notifications'));
  const userRef = doc(db, 'users', currentUser.uid);

  const batch = writeBatch(db);
  batch.update(fRef, {
    status: 'accepted',
    updatedAt: serverTimestamp(),
  });
  batch.update(userRef, {
    xp: increment(25),
    updatedAt: serverTimestamp(),
  });
  batch.set(notifRef, {
    id: notifRef.id,
    recipientId: requesterId,
    senderId: currentUser.uid,
    senderName: clampString(currentUser.displayName, 60),
    type: 'friend_accepted',
    title: 'Conexão aceita',
    body: `${clampString(currentUser.displayName, 40)} aceitou seu pedido de amizade.`,
    relatedId: currentUser.uid,
    read: false,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `friendships/${friendshipId}`);
  }
}

export async function removeFriendship(friendshipId: string): Promise<void> {
  const fRef = doc(db, 'friendships', friendshipId);
  try {
    await deleteDoc(fRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `friendships/${friendshipId}`);
  }
}

export async function markNotificationRead(notifId: string): Promise<void> {
  const nRef = doc(db, 'notifications', notifId);
  try {
    await updateDoc(nRef, { read: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${notifId}`);
  }
}

export async function fetchUserJoinedEventIds(uid: string): Promise<string[]> {
  try {
    const eventsSnap = await getDocs(
      query(collection(db, 'events'), where('status', '==', 'active'), limit(50))
    );
    const joined: string[] = [];
    await Promise.all(
      eventsSnap.docs.map(async (evDoc) => {
        try {
          const pSnap = await getDoc(doc(db, 'events', evDoc.id, 'participants', uid));
          if (pSnap.exists()) {
            joined.push(evDoc.id);
          }
        } catch {
          // Skip uncached participant subcollection doc when offline
        }
      })
    );
    return joined;
  } catch {
    return [];
  }
}

export async function geocodeLocationQuery(
  addressQuery: string
): Promise<{ lat: number; lng: number; city: string; displayName: string } | null> {
  if (!addressQuery.trim()) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&q=${encodeURIComponent(
      addressQuery.trim()
    )}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
      address?: { city?: string; town?: string; municipality?: string; state?: string };
    }>;
    if (!data.length) return null;
    const hit = data[0];
    const city =
      hit.address?.city ||
      hit.address?.town ||
      hit.address?.municipality ||
      hit.address?.state ||
      '';
    return {
      lat: parseFloat(hit.lat),
      lng: parseFloat(hit.lon),
      city,
      displayName: hit.display_name,
    };
  } catch {
    return null;
  }
}

export async function reverseGeocodeCoords(
  lat: number,
  lng: number
): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return '';
    const data = (await res.json()) as {
      address?: {
        city?: string;
        town?: string;
        municipality?: string;
        suburb?: string;
        state?: string;
      };
    };
    const city =
      data.address?.city ||
      data.address?.town ||
      data.address?.municipality ||
      data.address?.suburb ||
      '';
    const state = data.address?.state || '';
    if (city && state) return `${city}, ${state}`;
    return city || state || '';
  } catch {
    return '';
  }
}
