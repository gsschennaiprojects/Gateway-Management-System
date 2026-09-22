'use client';

import React, { useState } from 'react';
import { Camera } from 'lucide-react';

interface AccountAvatarProps {
  name: string;
  avatarUrl?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  editable?: boolean;
  onEditClick?: () => void;
  className?: string;
}

const SIZE_CONFIG = {
  sm: { container: 'w-8 h-8', text: 'text-xs', camera: 'w-3 h-3', overlay: 'p-0.5' },
  md: { container: 'w-12 h-12', text: 'text-lg', camera: 'w-4 h-4', overlay: 'p-1' },
  lg: { container: 'w-20 h-20', text: 'text-2xl', camera: 'w-5 h-5', overlay: 'p-1.5' },
  xl: { container: 'w-28 h-28', text: 'text-4xl', camera: 'w-6 h-6', overlay: 'p-2' },
};

export function AccountAvatar({
  name,
  avatarUrl,
  size = 'lg',
  editable = false,
  onEditClick,
  className = '',
}: AccountAvatarProps) {
  const [isHovered, setIsHovered] = useState(false);
  const config = SIZE_CONFIG[size];
  const initial = name?.charAt(0)?.toUpperCase() || '?';

  return (
    <div
      className={`relative inline-flex items-center justify-center group ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Gradient ring */}
      <div
        className={`${config.container} rounded-full p-[2px] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]`}
        style={{
          background: 'linear-gradient(135deg, #1A73E8 0%, #4285F4 50%, #34A853 100%)',
          boxShadow: isHovered
            ? '0 2px 10px rgba(26, 115, 232, 0.35)'
            : '0 1px 3px rgba(60, 64, 67, 0.15)',
        }}
      >
        {/* Inner circle */}
        <div className="w-full h-full rounded-full bg-[#E8F0FE] flex items-center justify-center overflow-hidden">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span
              className={`${config.text} font-semibold text-[#1A73E8] select-none`}
            >
              {initial}
            </span>
          )}
        </div>
      </div>

      {/* Camera edit overlay */}
      {editable && (
        <button
          onClick={onEditClick}
          className={`absolute bottom-0 right-0 ${config.overlay} rounded-full bg-white border-2 border-white text-[#5F6368] hover:text-[#1A73E8] hover:bg-[#F1F3F4] transition-all duration-200 cursor-pointer shadow-md`}
          aria-label="Change profile photo"
          title="Change profile photo"
        >
          <Camera className={config.camera} />
        </button>
      )}
    </div>
  );
}
