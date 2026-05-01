"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export function PropertyGallery({
  photos,
  name,
}: {
  photos: { url: string; caption?: string }[];
  name: string;
}) {
  const [lightbox, setLightbox] = useState<number | null>(null);

  const main = photos[0];
  const grid = photos.slice(1, 5);
  const remaining = Math.max(0, photos.length - 5);

  if (!main) return null;

  return (
    <>
      <div className="mb-6 grid gap-2 overflow-hidden rounded-3xl sm:grid-cols-4 sm:[grid-template-rows:repeat(2,1fr)]">
        <button
          onClick={() => setLightbox(0)}
          className="group relative aspect-[16/10] sm:col-span-2 sm:row-span-2 sm:aspect-auto"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={main.url}
            alt={main.caption ?? name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </button>
        {grid.map((p, i) => {
          const idx = i + 1;
          const isLast = i === grid.length - 1 && remaining > 0;
          return (
            <button
              key={p.url}
              onClick={() => setLightbox(idx)}
              className="group relative hidden aspect-[4/3] sm:block sm:aspect-auto"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={p.caption ?? ""}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              />
              {isLast && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-semibold text-white backdrop-blur-[2px]">
                  +{remaining} more
                </div>
              )}
            </button>
          );
        })}
      </div>

      {lightbox !== null && (
        <Lightbox
          photos={photos}
          startIndex={lightbox}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  );
}

function Lightbox({
  photos,
  startIndex,
  onClose,
}: {
  photos: { url: string; caption?: string }[];
  startIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const total = photos.length;
  const prev = () => setIndex((i) => (i - 1 + total) % total);
  const next = () => setIndex((i) => (i + 1) % total);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          prev();
        }}
        className="absolute left-4 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/25"
        aria-label="Previous"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          next();
        }}
        className="absolute right-4 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/25"
        aria-label="Next"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
      <button
        onClick={onClose}
        className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/25"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>
      <div
        className="relative max-h-[90vh] max-w-[92vw]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photos[index].url}
          alt={photos[index].caption ?? ""}
          className="max-h-[90vh] max-w-[92vw] rounded-2xl object-contain"
        />
        <div className="mt-3 text-center text-xs text-white/70">
          {index + 1} / {total}
        </div>
      </div>
    </div>
  );
}
