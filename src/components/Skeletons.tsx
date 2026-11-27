import React from 'react';

export const EventCardSkeleton: React.FC = () => (
  <div className="rounded-2xl bg-[#0E1117] border border-white/8 overflow-hidden animate-pulse">
    <div className="h-44 bg-white/5" />
    <div className="p-4 space-y-3">
      <div className="h-4 w-2/3 bg-white/8 rounded" />
      <div className="h-3 w-1/2 bg-white/5 rounded" />
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-white/8" />
          <div className="h-3 w-20 bg-white/5 rounded" />
        </div>
        <div className="h-9 w-24 rounded-xl bg-white/8" />
      </div>
    </div>
  </div>
);

export const ChatListSkeleton: React.FC = () => (
  <div className="space-y-3">
    {[0, 1, 2, 3].map((idx) => (
      <div
        key={idx}
        className="flex items-center gap-3.5 p-4 rounded-2xl bg-[#0E1117] border border-white/8 animate-pulse"
      >
        <div className="w-12 h-12 rounded-full bg-white/8 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-40 bg-white/8 rounded" />
          <div className="h-3 w-56 bg-white/5 rounded" />
        </div>
      </div>
    ))}
  </div>
);

export const ViewLoadingFallback: React.FC = () => (
  <div className="w-full max-w-6xl mx-auto px-4 py-6 space-y-4">
    <div className="h-8 w-48 bg-white/8 rounded-lg animate-pulse" />
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <EventCardSkeleton />
      <EventCardSkeleton />
      <EventCardSkeleton />
    </div>
  </div>
);
