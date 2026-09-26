'use client';

import React from 'react';

interface NivarpLogoProps {
  size?: 'sm' | 'md' | 'lg';
}

export function NivarpLogo({ size = 'md' }: NivarpLogoProps) {
  const iconDimensions = size === 'sm' ? 'w-7 h-7' : size === 'lg' ? 'w-10 h-10' : 'w-8 h-8';
  const titleSize = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm';
  const subtitleSize = size === 'sm' ? 'text-[6.5px]' : 'text-[7.5px]';

  return (
    <div className="flex items-center gap-3 group cursor-pointer select-none">
      {/* Borderless Pure White "N" with Trending Breakout Arrow */}
      <div className={`relative ${iconDimensions} shrink-0 flex items-center justify-center transition-transform duration-200 group-hover:scale-110`}>
        
        {/* Subtle Ambient Backlight */}
        <div className="absolute inset-0 bg-cyan-400/20 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Clean Frameless SVG */}
        <svg
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full overflow-visible relative z-10"
        >
          <defs>
            <filter id="arrowNeonGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="1.2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Pure White Bold Geometric "N" */}
          <path
            d="M6 29V8.5C6 7.67 6.67 7 7.5 7H10C10.55 7 11.07 7.3 11.34 7.78L22 23.5V8.5C22 7.67 22.67 7 23.5 7H25C25.83 7 26.5 7.67 26.5 8.5V27.5C26.5 28.33 25.83 29 25 29H22.5C21.95 29 21.43 28.7 21.16 28.22L10.5 12.5V27.5C10.5 28.33 9.83 29 9 29H7.5C6.67 29 6 28.33 6 27.5V29Z"
            fill="#FFFFFF"
          />

          {/* Trending Arrow on Top Right Edge of the N (Pointing Up-Right ↗) */}
          <g filter="url(#arrowNeonGlow)">
            {/* Arrow Stem */}
            <line
              x1="22"
              y1="12"
              x2="31"
              y2="3"
              stroke="#22D3EE"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
            {/* Arrow Head Pointing Up-Right */}
            <path
              d="M24.5 3H31V9.5"
              stroke="#22D3EE"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </svg>
      </div>

      {/* Typography: NIVARP & Discipline Subtitle */}
      <div className="flex flex-col justify-center">
        <div className="flex items-center gap-1.5 leading-none">
          <span className={`font-black tracking-[0.32em] ${titleSize} text-white font-sans uppercase group-hover:text-cyan-300 transition-colors`}>
            NIVARP
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] shrink-0" />
        </div>

        <div className="flex items-center gap-1 mt-1 text-zinc-500 font-mono">
          <span className={`tracking-[0.35em] uppercase font-bold ${subtitleSize} group-hover:text-cyan-400 transition-colors`}>
            FOLLOW THE RULES
          </span>
        </div>
      </div>
    </div>
  );
}