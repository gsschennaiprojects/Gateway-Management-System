'use client';

import React, { useState } from 'react';
import { Plus, X, ListTodo, CheckCircle2, Clock, Sparkles } from 'lucide-react';
import { serializeTasks } from '@/lib/worklogs/worklog-session-utils';

interface TaskPointInputProps {
  label: string;
  sublabel?: string;
  points: string[];
  onChange: (points: string[]) => void;
  placeholder?: string;
  icon?: 'completed' | 'pending' | 'default';
  accentColor?: string;
  disabled?: boolean;
  minPoints?: number;
}

export function TaskPointInput({
  label,
  sublabel,
  points,
  onChange,
  placeholder = 'Type a task point and press Enter...',
  icon = 'default',
  disabled = false,
}: TaskPointInputProps) {
  const [inputValue, setInputValue] = useState('');

  const addPoint = (text?: string) => {
    const raw = (text !== undefined ? text : inputValue).trim();
    if (!raw) return;

    // Check if user entered multiple items separated by semicolon or newline
    const items = raw
      .split(/[;\r\n]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    if (items.length > 0) {
      onChange([...points, ...items]);
      setInputValue('');
    }
  };

  const removePoint = (indexToRemove: number) => {
    if (disabled) return;
    onChange(points.filter((_, idx) => idx !== indexToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addPoint();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (pasted && (pasted.includes('\n') || pasted.includes(';'))) {
      e.preventDefault();
      const items = pasted
        .split(/[;\r\n]+/)
        .map((t) => t.trim())
        .filter(Boolean);
      if (items.length > 0) {
        onChange([...points, ...items]);
        setInputValue('');
      }
    }
  };

  // Icon selector
  const getIcon = () => {
    switch (icon) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-[var(--badge-success-text,#137333)]" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-[var(--badge-warning-text,#B06000)]" />;
      default:
        return <ListTodo className="w-4 h-4 text-[var(--brand-primary,#1A73E8)]" />;
    }
  };

  const semicolonPreview = serializeTasks(points);

  return (
    <div className="space-y-3">
      {/* Header with Title and Point Count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getIcon()}
          <div>
            <label className="text-xs font-semibold text-[var(--text-primary,#1F1F1F)] uppercase tracking-wider block">
              {label}
            </label>
            {sublabel && (
              <span className="text-[11px] text-[var(--text-secondary,#5F6368)]">{sublabel}</span>
            )}
          </div>
        </div>

        <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-[var(--bg-card-subtle,#F1F3F4)] text-[var(--text-secondary,#5F6368)] border border-[var(--border-subtle,#E8EAED)]">
          {points.length} {points.length === 1 ? 'point' : 'points'}
        </span>
      </div>

      {/* Point List */}
      <div className="space-y-2">
        {points.length === 0 ? (
          <div className="p-4 rounded-xl border border-dashed border-[var(--border-card,#DADCE0)] bg-[var(--bg-canvas,#F8FAFD)] text-center text-xs text-[var(--text-muted,#747775)]">
            No task points added yet. Type a point below or paste a list.
          </div>
        ) : (
          points.map((point, idx) => (
            <div
              key={idx}
              className="group flex items-start gap-2.5 p-3 rounded-xl bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-card,#DADCE0)] hover:border-[var(--brand-primary,#1A73E8)]/40 hover:bg-[var(--bg-card,#FFFFFF)] transition-all text-xs text-[var(--text-primary,#1F1F1F)]"
            >
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-primary,#1A73E8)] font-semibold text-[10px] shrink-0 mt-0.5">
                {idx + 1}
              </span>
              <span className="flex-1 leading-relaxed break-words font-medium">{point}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removePoint(idx)}
                  className="opacity-60 group-hover:opacity-100 text-[var(--text-secondary,#5F6368)] hover:text-[var(--badge-danger-text,#D93025)] p-1 rounded-md hover:bg-[var(--badge-danger-bg,#FCE8E6)] transition-all cursor-pointer shrink-0"
                  title="Remove point"
                  aria-label="Remove point"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Input Field & Add Button */}
      {!disabled && (
        <div className="flex items-center gap-2 pt-1">
          <input
            type="text"
            placeholder={placeholder}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            className="flex-1 h-10 px-4 text-xs rounded-full border border-[var(--border-card,#DADCE0)] bg-[var(--bg-card,#FFFFFF)] text-[var(--text-primary,#1F1F1F)] placeholder:text-[var(--text-muted,#747775)] focus:outline-none focus:border-[var(--brand-primary,#1A73E8)] focus:ring-2 focus:ring-[var(--brand-primary,#1A73E8)]/20 transition-all shadow-2xs"
          />
          <button
            type="button"
            onClick={() => addPoint()}
            disabled={!inputValue.trim()}
            className="h-10 px-4 rounded-full bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-primary,#1A73E8)] hover:bg-[var(--brand-primary,#1A73E8)] hover:text-white font-medium text-xs transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Point</span>
          </button>
        </div>
      )}

      {/* Semicolon Serialization Preview for Sheets */}
      {points.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-canvas,#F8FAFD)] border border-[var(--border-subtle,#E8EAED)] text-[11px] text-[var(--text-secondary,#5F6368)] overflow-hidden">
          <Sparkles className="w-3.5 h-3.5 text-[var(--brand-primary,#1A73E8)] shrink-0" />
          <span className="shrink-0 font-medium">Sheets Semicolon Format:</span>
          <span className="font-mono text-[10px] truncate text-[var(--text-muted,#747775)]" title={semicolonPreview}>
            "{semicolonPreview}"
          </span>
        </div>
      )}
    </div>
  );
}
