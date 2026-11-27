import React, { useState } from 'react';

interface UserAvatarProps {
  name?: string;
  photoURL?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isOnline?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<UserAvatarProps['size']>, string> = {
  xs: 'w-7 h-7 text-[10px]',
  sm: 'w-9 h-9 text-xs',
  md: 'w-11 h-11 text-sm',
  lg: 'w-16 h-16 text-lg',
  xl: 'w-24 h-24 text-2xl',
};

function getInitials(name?: string): string {
  if (!name) return 'A';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  photoURL,
  size = 'md',
  isOnline,
  className = '',
}) => {
  const [imgError, setImgError] = useState(false);
  const showImage = Boolean(photoURL && !imgError);

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      <div
        className={`${SIZE_CLASSES[size]} rounded-full overflow-hidden flex items-center justify-center font-display font-bold text-white bg-gradient-to-br from-cyan-500/30 via-slate-800 to-rose-500/30 border border-white/15`}
      >
        {showImage ? (
          <img
            src={photoURL}
            alt={name || 'Atleta'}
            referrerPolicy="no-referrer"
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span aria-hidden="true">{getInitials(name)}</span>
        )}
      </div>
      {isOnline === true && (
        <span
          title="Online agora"
          className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#06070B]"
        />
      )}
    </div>
  );
};
