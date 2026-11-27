import type { AchievementItem, SportType, UserPublic } from '../types/orca';

export interface SportMeta {
  id: SportType;
  label: string;
  accentHex: string;
  coverURL: string;
}

export const SPORTS_CATALOG: SportMeta[] = [
  {
    id: 'Futebol',
    label: 'Futebol',
    accentHex: '#22D3EE',
    coverURL: '/src/assets/images/orca_sport_futebol_1795818938513.jpg',
  },
  {
    id: 'Basquete',
    label: 'Basquete',
    accentHex: '#F97316',
    coverURL: '/src/assets/images/orca_sport_basquete_1795818938231.jpg',
  },
  {
    id: 'Vôlei',
    label: 'Vôlei',
    accentHex: '#F43F5E',
    coverURL: '/src/assets/images/orca_sport_volei_1795818938538.jpg',
  },
  {
    id: 'Corrida',
    label: 'Corrida',
    accentHex: '#38BDF8',
    coverURL: '/src/assets/images/orca_sport_corrida_1795818938707.jpg',
  },
  {
    id: 'Tênis',
    label: 'Tênis',
    accentHex: '#A3E635',
    coverURL: '/src/assets/images/orca_sport_volei_1795818938538.jpg',
  },
  {
    id: 'Beach Tennis',
    label: 'Beach Tennis',
    accentHex: '#FB7185',
    coverURL: '/src/assets/images/orca_sport_volei_1795818938538.jpg',
  },
  {
    id: 'Ciclismo',
    label: 'Ciclismo',
    accentHex: '#2DD4BF',
    coverURL: '/src/assets/images/orca_sport_corrida_1795818938707.jpg',
  },
  {
    id: 'Funcional',
    label: 'Funcional',
    accentHex: '#EC4899',
    coverURL: '/src/assets/images/orca_sport_basquete_1795818938231.jpg',
  },
];

export function getSportMeta(sport: string): SportMeta {
  return (
    SPORTS_CATALOG.find((s) => s.id === sport) || {
      id: 'Futebol',
      label: sport || 'Esporte',
      accentHex: '#22D3EE',
      coverURL: '/src/assets/images/orca_sport_futebol_1795818938513.jpg',
    }
  );
}

/** Haversine real-world distance in kilometers */
export function calculateDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Real compass bearing in degrees from point 1 to point 2 */
export function calculateBearingDeg(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const y = Math.sin(toRad(lng2 - lng1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lng2 - lng1));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function formatDistanceKm(km: number): string {
  if (!Number.isFinite(km)) return '—';
  if (km < 1) {
    return `${Math.max(50, Math.round(km * 1000))} m`;
  }
  return `${km.toFixed(1)} km`;
}

export function formatPriceBRL(price: number): string {
  if (!price || price <= 0) return 'Gratuito';
  return price.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function formatEventTime(startsAtMs: number): string {
  const now = Date.now();
  const diffMin = Math.round((startsAtMs - now) / 60000);
  if (diffMin >= -15 && diffMin <= 15) return 'Agora';
  if (diffMin > 15 && diffMin < 60) return `Em ${diffMin} min`;

  const date = new Date(startsAtMs);
  const today = new Date();
  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  const timeStr = date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (isToday) return `Hoje, ${timeStr}`;

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const isTomorrow =
    date.getDate() === tomorrow.getDate() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getFullYear() === tomorrow.getFullYear();

  if (isTomorrow) return `Amanhã, ${timeStr}`;

  return `${date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  })} · ${timeStr}`;
}

export function formatRelativeTimestamp(ts?: { toMillis: () => number } | null): string {
  if (!ts) return '';
  const diffSec = Math.floor((Date.now() - ts.toMillis()) / 1000);
  if (diffSec < 45) return 'Agora';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return new Date(ts.toMillis()).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
}

export function computeLevelFromXp(xp: number): {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPct: number;
  tierLabel: string;
} {
  const safeXp = Math.max(0, Math.floor(xp || 0));
  const xpPerLevel = 300;
  const level = Math.floor(safeXp / xpPerLevel) + 1;
  const currentLevelXp = safeXp % xpPerLevel;
  const progressPct = Math.min(100, Math.round((currentLevelXp / xpPerLevel) * 100));

  let tierLabel = 'Nível Bronze';
  if (level >= 20) tierLabel = 'Nível Lenda';
  else if (level >= 12) tierLabel = 'Nível Diamante';
  else if (level >= 6) tierLabel = 'Nível Ouro';
  else if (level >= 3) tierLabel = 'Nível Prata';

  return {
    level,
    currentLevelXp,
    nextLevelXp: xpPerLevel,
    progressPct,
    tierLabel,
  };
}

export function computeRealAchievements(
  profile: UserPublic | null,
  friendsCount: number
): AchievementItem[] {
  const matches = profile?.matchesCount || 0;
  const hosted = profile?.eventsHostedCount || 0;
  const xp = profile?.xp || 0;

  return [
    {
      id: 'first_match',
      title: 'Em Campo',
      description: 'Participe do seu primeiro evento real.',
      unlocked: matches >= 1,
      progressLabel: `${Math.min(matches, 1)}/1 partida`,
      tier: 'bronze',
    },
    {
      id: 'host_starter',
      title: 'Capitão de Arena',
      description: 'Crie e publique seu primeiro evento esportivo.',
      unlocked: hosted >= 1,
      progressLabel: `${Math.min(hosted, 1)}/1 evento`,
      tier: 'gold',
    },
    {
      id: 'connector',
      title: 'Conector Real',
      description: 'Adicione 3 atletas reais à sua rede.',
      unlocked: friendsCount >= 3,
      progressLabel: `${Math.min(friendsCount, 3)}/3 amigos`,
      tier: 'cyan',
    },
    {
      id: 'veteran_xp',
      title: 'Ritmo Constante',
      description: 'Alcance 500 XP em atividades reais.',
      unlocked: xp >= 500,
      progressLabel: `${Math.min(xp, 500)}/500 XP`,
      tier: 'silver',
    },
  ];
}

/** Client-side WebP/JPEG image compression for fast uploads & performance */
export async function compressImageFile(
  file: File,
  maxWidth = 1080,
  maxHeight = 1080,
  quality = 0.82
): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Selecione um arquivo de imagem válido.');
  }
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
  const targetW = Math.max(1, Math.round(bitmap.width * ratio));
  const targetH = Math.max(1, Math.round(bitmap.height * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close();

  return await new Promise<Blob>((resolve) => {
    canvas.toBlob(
      (blob) => {
        resolve(blob || file);
      },
      'image/webp',
      quality
    );
  });
}

export function sanitizeUsername(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_.]/g, '')
    .slice(0, 24);
  return cleaned.length >= 2 ? cleaned : `atleta_${Math.floor(1000 + Math.random() * 9000)}`;
}
