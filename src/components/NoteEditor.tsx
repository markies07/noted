'use client';

import React, { useRef, useEffect, KeyboardEvent } from 'react';
import { X, Copy } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type LineKind = 'normal' | 'checkbox' | 'copyable';

export interface EditorLine {
  id: string;
  kind: LineKind;
  text: string;
  checked?: boolean;
  copyGroupId?: string;
}

// ─── uid helper ───────────────────────────────────────────────────────────────
let _idCounter = 0;
const uid = () => String(++_idCounter);

// ─── Parse raw content → EditorLines ──────────────────────────────────────────
export function parseContent(raw: string): EditorLine[] {
  const rawLines = raw.split('\n');
  const result: EditorLine[] = [];
  let i = 0;

  while (i < rawLines.length) {
    const line = rawLines[i];

    if (line.trim() === '[copy-start]') {
      i++;
      const gid = uid();
      while (i < rawLines.length && rawLines[i].trim() !== '[copy-end]') {
        result.push({ id: uid(), kind: 'copyable', text: rawLines[i], copyGroupId: gid });
        i++;
      }
      i++; // skip [copy-end]
      continue;
    }

    if (/^\[copy\]\s*/i.test(line)) {
      const gid = uid();
      result.push({ id: uid(), kind: 'copyable', text: line.replace(/^\[copy\]\s*/i, ''), copyGroupId: gid });
      i++;
      continue;
    }

    const cbMatch = line.match(/^\s*-?\s*\[([ xX])\]\s*(.*)/);
    if (cbMatch) {
      result.push({ id: uid(), kind: 'checkbox', checked: cbMatch[1].toLowerCase() === 'x', text: cbMatch[2] });
      i++;
      continue;
    }

    result.push({ id: uid(), kind: 'normal', text: line });
    i++;
  }

  return result;
}

// ─── Serialize EditorLines → raw content ──────────────────────────────────────
export function serializeLines(lines: EditorLine[]): string {
  // Count how many lines share each copyGroupId
  const gidCount: Record<string, number> = {};
  for (const l of lines) {
    if (l.kind === 'copyable' && l.copyGroupId) {
      gidCount[l.copyGroupId] = (gidCount[l.copyGroupId] ?? 0) + 1;
    }
  }

  const out: string[] = [];
  const emittedGids = new Set<string>();
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.kind === 'copyable') {
      const gid = line.copyGroupId ?? '';
      const count = gidCount[gid] ?? 1;

      if (count > 1) {
        if (!emittedGids.has(gid)) {
          emittedGids.add(gid);
          const group = lines.filter(l => l.kind === 'copyable' && l.copyGroupId === gid);
          out.push('[copy-start]');
          group.forEach(g => out.push(g.text));
          out.push('[copy-end]');
        }
        i++;
        continue;
      }

      out.push(`[copy] ${line.text}`);
      i++;
      continue;
    }

    if (line.kind === 'checkbox') {
      out.push(`- [${line.checked ? 'x' : ' '}] ${line.text}`);
    } else {
      out.push(line.text);
    }
    i++;
  }

  return out.join('\n');
}

// ─── Auto-resize a textarea to fit its content ────────────────────────────────
function autoResize(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

// ─── Auto-resizing textarea ───────────────────────────────────────────────────
interface AutoTextareaProps {
  value: string;
  onChange: (val: string) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onFocus?: () => void;
  className?: string;
  placeholder?: string;
  inputRef?: (el: HTMLTextAreaElement | null) => void;
}

function AutoTextarea({ value, onChange, onKeyDown, onFocus, className, placeholder, inputRef }: AutoTextareaProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  // Resize on every render so initial load and programmatic changes are handled
  useEffect(() => {
    if (ref.current) autoResize(ref.current);
  });

  return (
    <textarea
      ref={el => {
        ref.current = el;
        inputRef?.(el);
      }}
      value={value}
      rows={1}
      onChange={e => {
        onChange(e.target.value);
        autoResize(e.target);
      }}
      onKeyDown={onKeyDown}
      onFocus={() => {
        if (ref.current) autoResize(ref.current);
        onFocus?.();
      }}
      placeholder={placeholder}
      spellCheck={false}
      className={`resize-none overflow-hidden leading-relaxed ${className ?? ''}`}
      style={{ minHeight: '1.75rem' }}
    />
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface NoteEditorProps {
  lines: EditorLine[];
  onChange: (lines: EditorLine[]) => void;
  isMaximized: boolean;
  onFocusedIndexChange?: (index: number) => void;
}

// ─── Main NoteEditor ──────────────────────────────────────────────────────────
export default function NoteEditor({ lines, onChange, isMaximized, onFocusedIndexChange }: NoteEditorProps) {
  const inputRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const focusTarget = useRef<number | null>(null);

  useEffect(() => {
    if (focusTarget.current !== null) {
      const idx = Math.min(focusTarget.current, lines.length - 1);
      inputRefs.current[idx]?.focus();
      focusTarget.current = null;
    }
  });

  const updateLine = (index: number, patch: Partial<EditorLine>) => {
    onChange(lines.map((l, i) => i === index ? { ...l, ...patch } : l));
  };

  const insertAfter = (index: number) => {
    const next = [...lines.slice(0, index + 1), { id: uid(), kind: 'normal' as const, text: '' }, ...lines.slice(index + 1)];
    focusTarget.current = index + 1;
    onChange(next);
  };

  const deleteLine = (index: number) => {
    if (lines.length <= 1) { onChange([{ id: uid(), kind: 'normal', text: '' }]); return; }
    focusTarget.current = Math.max(0, index - 1);
    onChange(lines.filter((_, i) => i !== index));
  };

  // Group lines by copyGroupId for rendering
  // We render each group as one visual block
  const rendered: React.ReactNode[] = [];
  const seenGroupIds = new Set<string>();

  // Count gid occurrences to know which are groups vs singles
  const gidCount: Record<string, number> = {};
  for (const l of lines) {
    if (l.kind === 'copyable' && l.copyGroupId) {
      gidCount[l.copyGroupId] = (gidCount[l.copyGroupId] ?? 0) + 1;
    }
  }

  lines.forEach((line, index) => {
    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        insertAfter(index);
      }
      if (e.key === 'Backspace' && line.text === '') {
        e.preventDefault();
        if (!(index === 0 && lines.length === 1)) deleteLine(index);
      }
    };

    // ── Copyable line ─────────────────────────────────────────────────────────
    if (line.kind === 'copyable') {
      const gid = line.copyGroupId ?? '';
      const isGroup = (gidCount[gid] ?? 1) > 1;

      if (isGroup) {
        // Only render the group block once, at the first line's position
        if (seenGroupIds.has(gid)) return; // skip subsequent lines — they're inside the block below
        seenGroupIds.add(gid);

        const groupLines = lines
          .map((l, i) => ({ l, i }))
          .filter(({ l }) => l.kind === 'copyable' && l.copyGroupId === gid);

        rendered.push(
          <div key={gid} className="rounded-xl bg-blue-50/60 border border-blue-200 overflow-hidden">
            {/* Group header */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100/60 border-b border-blue-200">
              <Copy className="w-3 h-3 text-blue-500" />
              <span className="text-xs font-semibold text-blue-600 select-none">copy block — click to copy all</span>
              {/* Remove group — convert all back to normal */}
              <button
                onMouseDown={e => e.preventDefault()}
                onClick={() => {
                  onChange(lines.map(l =>
                    l.kind === 'copyable' && l.copyGroupId === gid
                      ? { ...l, kind: 'normal' as const, copyGroupId: undefined }
                      : l
                  ));
                }}
                className="ml-auto w-5 h-5 flex items-center justify-center rounded-full hover:bg-blue-200 text-blue-400 hover:text-blue-700 cursor-pointer"
                title="Remove copyable (keeps text)"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            {/* Each line in the group */}
            <div className="px-3 py-2 space-y-1">
              {groupLines.map(({ l, i }) => (
                <AutoTextarea
                  key={l.id}
                  value={l.text}
                  onChange={val => updateLine(i, { text: val })}
                  onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); insertAfter(i); }
                    if (e.key === 'Backspace' && l.text === '') { e.preventDefault(); if (!(i === 0 && lines.length === 1)) deleteLine(i); }
                  }}
                  onFocus={() => onFocusedIndexChange?.(i)}
                  className="w-full bg-transparent outline-none text-base text-[#1a1a1a] placeholder-black/30 py-0.5"
                  placeholder="Copyable text…"
                  inputRef={el => { inputRefs.current[i] = el; }}
                />
              ))}
            </div>
          </div>
        );
        return;
      }

      // Single copyable line
      rendered.push(
        <div key={line.id} className="flex items-start gap-2 group">
          <span className="shrink-0 flex items-center gap-1 bg-blue-100 text-blue-600 text-xs font-semibold px-2 py-1.5 rounded-full border border-blue-200 select-none mt-0.5">
            <Copy className="w-3 h-3" />
            copy
          </span>
          <AutoTextarea
            value={line.text}
            onChange={val => updateLine(index, { text: val })}
            onKeyDown={handleKeyDown}
            onFocus={() => onFocusedIndexChange?.(index)}
            className="flex-1 bg-blue-50/60 border border-blue-200 rounded-lg px-3 py-1.5 text-base text-[#1a1a1a] outline-none focus:border-blue-400 focus:bg-white/70 transition-all"
            placeholder="Copyable text…"
            inputRef={el => { inputRefs.current[index] = el; }}
          />
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={() => updateLine(index, { kind: 'normal', copyGroupId: undefined })}
            className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded-full hover:bg-black/10 text-black/40 hover:text-black/70 cursor-pointer shrink-0 mt-1"
            title="Remove copyable (keeps text)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      );
      return;
    }

    // ── Checkbox line ─────────────────────────────────────────────────────────
    if (line.kind === 'checkbox') {
      rendered.push(
        <div key={line.id} className="flex items-start gap-2.5 group">
          {/* Checkbox toggle — onMouseDown prevents textarea blur */}
          <div
            className="relative shrink-0 w-5 h-5 mt-1 cursor-pointer"
            onMouseDown={e => e.preventDefault()}
            onClick={() => updateLine(index, { checked: !line.checked })}
          >
            <input
              type="checkbox"
              checked={!!line.checked}
              readOnly
              className="appearance-none w-5 h-5 rounded-md border-2 border-black/25 bg-transparent checked:bg-black checked:border-black transition-all cursor-pointer"
            />
            {line.checked && (
              <svg className="absolute inset-0 w-5 h-5 p-1 text-white pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <AutoTextarea
            value={line.text}
            onChange={val => updateLine(index, { text: val })}
            onKeyDown={handleKeyDown}
            onFocus={() => onFocusedIndexChange?.(index)}
            className={`flex-1 bg-transparent outline-none text-base text-[#1a1a1a] placeholder-black/30 py-0.5 ${line.checked ? 'line-through text-black/40' : ''}`}
            placeholder="Task…"
            inputRef={el => { inputRefs.current[index] = el; }}
          />
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={() => deleteLine(index)}
            className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded-full hover:bg-black/10 text-black/40 hover:text-black/70 cursor-pointer shrink-0 mt-0.5"
            title="Remove checkbox"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      );
      return;
    }

    // ── Normal line ───────────────────────────────────────────────────────────
    rendered.push(
      <AutoTextarea
        key={line.id}
        value={line.text}
        onChange={val => updateLine(index, { text: val })}
        onKeyDown={handleKeyDown}
        onFocus={() => onFocusedIndexChange?.(index)}
        className="w-full bg-transparent outline-none text-base text-[#1a1a1a] placeholder-black/30 py-0.5"
        placeholder={index === 0 ? 'Write your note here…' : ''}
        inputRef={el => { inputRefs.current[index] = el; }}
      />
    );
  });

  return (
    <div className={`space-y-1.5 rounded-xl bg-white/25 border border-black/10 p-4 ${isMaximized ? 'min-h-[60vh]' : 'min-h-45'}`}>
      {rendered}
    </div>
  );
}
