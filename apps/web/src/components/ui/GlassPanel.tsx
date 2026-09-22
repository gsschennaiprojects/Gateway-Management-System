import React from 'react';

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'default' | 'subtle' | 'elevated' | 'floating' | 'interactive';
  className?: string;
  as?: React.ElementType;
  animate?: boolean;
  stagger?: number;
}

export function GlassPanel({
  children,
  variant = 'default',
  className = '',
  as: Component = 'div',
  animate = false,
  stagger,
  ...props
}: GlassPanelProps) {
  const variantClass = {
    default: 'glass-panel',
    subtle: 'glass-panel-subtle',
    elevated: 'glass-panel-elevated',
    floating: 'glass-panel-floating',
    interactive: 'glass-panel glass-panel-interactive',
  }[variant];

  const animClass = animate ? 'animate-fade-in-up' : '';
  const staggerClass = stagger ? `stagger-${stagger}` : '';

  return (
    <Component
      className={`${variantClass} ${animClass} ${staggerClass} ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}
