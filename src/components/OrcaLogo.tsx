import React from 'react';

interface OrcaLogoProps {
  compact?: boolean;
  showTagline?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const OrcaLogo: React.FC<OrcaLogoProps> = ({
  compact = false,
  showTagline = false,
  size = 'md',
}) => {
  const iconDim = size === 'lg' ? 56 : size === 'sm' ? 28 : 34;
  const titleClass =
    size === 'lg'
      ? 'text-3xl tracking-[0.22em]'
      : size === 'sm'
      ? 'text-base tracking-[0.14em]'
      : 'text-lg tracking-[0.16em]';

  return (
    <div className="inline-flex items-center gap-2.5 select-none shrink-0">
      <svg
        width={iconDim}
        height={iconDim}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <defs>
          <linearGradient id="orcaFinGrad" x1="8" y1="54" x2="54" y2="10" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#22D3EE" />
            <stop offset="55%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#F8FAFC" />
          </linearGradient>
          <linearGradient id="orcaWaveGrad" x1="16" y1="48" x2="56" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#22D3EE" />
            <stop offset="50%" stopColor="#EC4899" />
            <stop offset="100%" stopColor="#F43F5E" />
          </linearGradient>
        </defs>
        <path
          d="M16 54C11 43 13 24 27 12C36 4 47 4 51 8C53 10 51 19 45 26C37 35 28 38 23 48C21 52 18 55 16 54Z"
          fill="url(#orcaFinGrad)"
        />
        <ellipse
          cx="39"
          cy="17"
          rx="4.2"
          ry="2.6"
          transform="rotate(-32 39 17)"
          fill="#06070B"
        />
        <path
          d="M27 41C34 34 45 31 53 36C54 37 52 41 47 42C40 43 35 46 31 51C28 47 27 44 27 41Z"
          fill="url(#orcaWaveGrad)"
        />
      </svg>
      {!compact && (
        <div className="flex flex-col leading-none">
          <span className={`font-display font-extrabold whitespace-nowrap orca-gradient-text ${titleClass}`}>
            ORCA
          </span>
          {showTagline && (
            <span className="text-[10px] font-medium tracking-[0.28em] text-slate-400 mt-1 whitespace-nowrap">
              SPORTS
            </span>
          )}
        </div>
      )}
    </div>
  );
};
