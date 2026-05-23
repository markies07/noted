'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface NoteContentProps {
  content: string;
  isEditing: boolean;
  onContentChange: (newContent: string) => void;
  isPreview?: boolean;
  inNoteSearchQuery?: string;
}

// ─── highlight search terms ───────────────────────────────────────────────────
function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-yellow-300 text-black rounded px-0.5">{part}</mark>
    ) : part
  );
}

// ─── "Copied!" flash overlay ──────────────────────────────────────────────────
function CopiedFlash({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ duration: 0.15 }}
          className="absolute inset-0 flex items-center justify-center rounded-xl z-10 pointer-events-none"
        >
          <span className="bg-black/80 text-white text-sm font-semibold px-4 py-1.5 rounded-full shadow-lg">
            Copied!
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Detect if a string is a "link-like" — no spaces, long continuous chars (URLs)
function isLinkLike(text: string): boolean {
  return text.length > 30 && !/\s/.test(text);
}

// ─── Copyable block (view mode) ───────────────────────────────────────────────
// "lines" is the display text; "copyText" is exactly what gets copied
function CopyableBlock({ lines, copyText, query }: { lines: string[]; copyText: string; query: string }) {
  const [copied, setCopied] = useState(false);

  const handleClick = () => {
    navigator.clipboard.writeText(copyText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };

  return (
    <div className="block">
      <div
        onClick={handleClick}
        className={`relative inline-flex flex-col rounded-xl border-2 px-4 py-2.5 cursor-pointer select-none transition-all duration-200 max-w-full ${
          copied
            ? 'border-green-400 bg-green-50/40'
            : 'border-black/20 hover:border-black/40 hover:bg-black/3'
        }`}
        title="Click to copy"
      >
        <CopiedFlash show={copied} />
        <div className="space-y-0.5">
          {lines.map((line, i) => (
            <p
              key={i}
              className={`text-lg text-[#1a1a1a]/90 leading-relaxed ${
                isLinkLike(line) ? 'truncate max-w-130' : 'whitespace-pre-wrap'
              }`}
            >
              {line ? highlightText(line, query) : <span className="invisible">·</span>}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Preview version (card) ───────────────────────────────────────────────────
function CopyableBlockPreview({ lines }: { lines: string[] }) {
  return (
    <div className="block">
      <div className="inline-flex flex-col rounded-lg border border-black/15 px-3 py-1 max-w-full">
        {lines.map((line, i) => (
          <p key={i} className="text-sm text-[#1a1a1a]/60 leading-relaxed truncate max-w-55">
            {line || ' '}
          </p>
        ))}
      </div>
    </div>
  );
}

// ─── Segment types ────────────────────────────────────────────────────────────
// copyText = the original raw text that was selected (preserved exactly)
type CopyableSegment = { type: 'copyable'; lines: string[]; copyText: string };
type NormalLine = {
  raw: string;
  isCheckbox: boolean;
  checked: boolean;
  text: string;
  originalIndex: number;
};
type NormalSegment = { type: 'normal'; lines: NormalLine[] };
type Segment = CopyableSegment | NormalSegment;

// ─── Parser ───────────────────────────────────────────────────────────────────
// Markers:
//   [copy-start]...[copy-end]  → multi-line group, copies exactly the inner text
//   [copy]text                 → single-line shorthand (legacy / Copy All)
function parseSegments(content: string): Segment[] {
  const rawLines = content.split('\n');
  const segments: Segment[] = [];
  let i = 0;

  while (i < rawLines.length) {
    const line = rawLines[i];

    // ── multi-line group ──────────────────────────────────────────────────────
    if (line.trim() === '[copy-start]') {
      i++; // skip the marker line
      const innerLines: string[] = [];
      while (i < rawLines.length && rawLines[i].trim() !== '[copy-end]') {
        innerLines.push(rawLines[i]);
        i++;
      }
      i++; // skip [copy-end]
      segments.push({ type: 'copyable', lines: innerLines, copyText: innerLines.join('\n') });
      continue;
    }

    // ── single-line [copy] shorthand ──────────────────────────────────────────
    if (/^\[copy\]\s*/i.test(line)) {
      const displayLine = line.replace(/^\[copy\]\s*/i, '');
      segments.push({ type: 'copyable', lines: [displayLine], copyText: displayLine });
      i++;
      continue;
    }

    // ── normal line ───────────────────────────────────────────────────────────
    const checkboxRegex = /^(\s*(-?\s*))\[([ xX])\]\s*(.*)/;
    const cbMatch = line.match(checkboxRegex);
    const normalLine: NormalLine = {
      raw: line,
      isCheckbox: !!cbMatch,
      checked: cbMatch ? cbMatch[3].toLowerCase() === 'x' : false,
      text: cbMatch ? cbMatch[4] : line,
      originalIndex: i,
    };

    const last = segments[segments.length - 1];
    if (last && last.type === 'normal') {
      last.lines.push(normalLine);
    } else {
      segments.push({ type: 'normal', lines: [normalLine] });
    }
    i++;
  }

  return segments;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function NoteContent({
  content,
  isEditing,
  onContentChange,
  isPreview = false,
  inNoteSearchQuery = '',
}: NoteContentProps) {
  if (!content) {
    return <p className="text-lg text-[#1a1a1a]/40 italic">No content added...</p>;
  }

  const toggleCheckbox = (lineIndex: number) => {
    const lines = content.split('\n');
    const line = lines[lineIndex];
    const match = line.match(/^(\s*(-?\s*))\[([ xX])\]/);
    if (match) {
      const newStatus = match[3] === ' ' ? 'x' : ' ';
      lines[lineIndex] = line.replace(/\[([ xX])\]/, `[${newStatus}]`);
      onContentChange(lines.join('\n'));
    }
  };

  if (isEditing) return null;

  const segments = parseSegments(content);

  return (
    <div className={`space-y-2 ${isPreview ? 'py-0' : 'py-2'}`}>
      {segments.map((segment, segIdx) => {
        // ── copyable block ──────────────────────────────────────────────────
        if (segment.type === 'copyable') {
          if (isPreview) return <CopyableBlockPreview key={segIdx} lines={segment.lines} />;
          return (
            <CopyableBlock
              key={segIdx}
              lines={segment.lines}
              copyText={segment.copyText}
              query={inNoteSearchQuery}
            />
          );
        }

        // ── normal lines ────────────────────────────────────────────────────
        return (
          <div key={segIdx} className={`space-y-1.5 ${isPreview ? 'py-0' : ''}`}>
            {segment.lines.map((nl) => {
              // checkbox
              if (nl.isCheckbox) {
                return (
                  <div key={nl.originalIndex} className={`flex items-start gap-3 ${isPreview ? 'py-0' : 'py-0.5'}`}>
                    <div className={`flex items-center shrink-0 ${isPreview ? 'h-5' : 'h-7'}`}>
                      <div
                        className={`relative flex items-center justify-center ${isPreview ? 'w-4 h-4' : 'w-5 h-5'} cursor-pointer`}
                        onClick={(e) => { e.stopPropagation(); toggleCheckbox(nl.originalIndex); }}
                      >
                        <input
                          type="checkbox"
                          checked={nl.checked}
                          readOnly
                          className={`appearance-none rounded-md border-2 transition-all duration-200 ease-out cursor-pointer ${
                            isPreview ? 'w-4 h-4 border-black/10' : 'w-5 h-5 border-black/20'
                          } bg-transparent checked:bg-black checked:border-black hover:border-black/40 active:scale-95`}
                        />
                        {nl.checked && (
                          <motion.svg
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className={`absolute ${isPreview ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'} text-white pointer-events-none`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </motion.svg>
                        )}
                      </div>
                    </div>
                    <span
                      className={`transition-all duration-300 ${
                        isPreview ? 'text-sm leading-5 py-0 text-[#1a1a1a]/60' : 'text-lg leading-7 py-0.5 text-[#1a1a1a]/90'
                      }`}
                      onClick={() => { if (!isPreview) toggleCheckbox(nl.originalIndex); }}
                      style={{ cursor: isPreview ? 'inherit' : 'pointer' }}
                    >
                      {nl.text ? highlightText(nl.text, inNoteSearchQuery) : <span className="invisible">·</span>}
                    </span>
                  </div>
                );
              }

              // plain text
              if (isPreview) {
                return (
                  <p key={nl.originalIndex} className="text-sm text-[#1a1a1a]/60 leading-relaxed min-h-5 py-0 truncate overflow-hidden">
                    {nl.raw ? highlightText(nl.raw, inNoteSearchQuery) : ' '}
                  </p>
                );
              }
              return (
                <p
                  key={nl.originalIndex}
                  className={`text-lg text-[#1a1a1a]/80 leading-relaxed min-h-7 py-0.5 ${
                    isLinkLike(nl.raw) ? 'truncate' : 'whitespace-pre-wrap'
                  }`}
                >
                  {nl.raw ? highlightText(nl.raw, inNoteSearchQuery) : ' '}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
