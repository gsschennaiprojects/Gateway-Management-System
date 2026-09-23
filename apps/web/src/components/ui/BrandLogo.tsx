import React from 'react';
import Image from 'next/image';

interface BrandLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero';
  showText?: boolean;
  collapsed?: boolean;
  title?: string;
  subtitle?: string;
  className?: string;
  glowOnHover?: boolean;
  theme?: 'light' | 'dark' | 'eye-care';
}

const SIZE_MAP = {
  xs: { icon: 22, textClass: 'text-xs', subClass: 'text-[9px]' },
  sm: { icon: 28, textClass: 'text-sm', subClass: 'text-[10px]' },
  md: { icon: 34, textClass: 'text-base', subClass: 'text-[11px]' },
  lg: { icon: 44, textClass: 'text-lg', subClass: 'text-xs' },
  xl: { icon: 56, textClass: 'text-xl', subClass: 'text-xs' },
  hero: { icon: 72, textClass: 'text-2xl', subClass: 'text-sm' },
};

export function BrandLogo({
  size = 'md',
  showText = true,
  collapsed = false,
  title = 'Gateway',
  subtitle = 'Software Solutions',
  className = '',
  glowOnHover = false,
  theme,
}: BrandLogoProps) {
  const config = SIZE_MAP[size] || SIZE_MAP.md;

  return (
    <div
      className={`inline-flex items-center gap-2.5 select-none group transition-transform duration-200 shrink-0 ${className}`}
    >
      {/* Logo Icon Container - strictly sized, never clipped with luxury liquid glass feel */}
      <div
        className="relative flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105"
        style={{
          width: config.icon + 4,
          height: config.icon + 4,
        }}
      >
        <Image
          src="/brand/gss-liquid-icon.png"
          alt="Gateway Software Solutions"
          width={config.icon + 4}
          height={config.icon + 4}
          priority
          className="w-full h-full object-contain shrink-0 drop-shadow-xs"
        />
      </div>

      {/* Brand Typography - "Gateway" in big + "Software Solutions" in same length */}
      {showText && !collapsed && (
        <div className="flex flex-col min-w-0 leading-tight">
          <span
            className="font-bold text-lg sm:text-[18px] tracking-tight text-[var(--text-primary,#1F1F1F)] leading-none truncate"
          >
            {title}
          </span>
          {subtitle && (
            <span
              className="text-[9.5px] font-semibold tracking-[0.14em] text-[var(--text-secondary,#5F6368)] uppercase leading-none mt-1 whitespace-nowrap"
            >
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
