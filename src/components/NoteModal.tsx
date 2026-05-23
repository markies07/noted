'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Note, NoteColor, NoteFormData } from '@/types/note';
import {
  X, Star, Trash2, CheckSquare, Clipboard, Copy,
  Maximize2, Minimize2, Search, XCircle, Pencil,
  ChevronUp, ChevronDown,
} from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import NoteContent from './NoteContent';
import NoteEditor, { parseContent, serializeLines } from './NoteEditor';
import type { EditorLine } from './NoteEditor';

// re-export EditorLine so NoteEditor.tsx can keep it private
// (we import it directly above)

interface NoteModalProps {
  note: Note | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, data: NoteFormData) => void;
  onDelete: (id: string) => void;
  searchQuery?: string;
}

const colorOptions: { color: NoteColor; class: string }[] = [
  { color: 'yellow', class: 'bg-[#FFE4A1]' },
  { color: 'orange', class: 'bg-[#FFB899]' },
  { color: 'lime',   class: 'bg-[#E4F5A1]' },
  { color: 'purple', class: 'bg-[#C9B3FF]' },
  { color: 'cyan',   class: 'bg-[#7AEFFF]'  },
];

const colorClasses: Record<NoteColor, string> = {
  yellow: 'bg-[#FFE4A1]',
  orange: 'bg-[#FFB899]',
  lime:   'bg-[#E4F5A1]',
  purple: 'bg-[#C9B3FF]',
  cyan:   'bg-[#7AEFFF]',
};

const backdropVariants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.25 } },
  exit:    { opacity: 0, transition: { duration: 0.2 } },
};

const modalVariants = {
  hidden:  { opacity: 0, scale: 0.85, y: 40 },
  visible: { opacity: 1, scale: 1,    y: 0,  transition: { type: 'spring' as const, stiffness: 320, damping: 26, delay: 0.08 } },
  exit:    { opacity: 0, scale: 0.92, y: 24, transition: { duration: 0.18 } },
};

// small uid helper (for inserting new lines from toolbar)
let _mid = 0;
const mid = () => `m${++_mid}`;

export default function NoteModal({ note, isOpen, onClose, onSave, onDelete, searchQuery = '' }: NoteModalProps) {
  const [title,             setTitle]             = useState('');
  const [content,           setContent]           = useState('');
  const [editorLines,       setEditorLines]       = useState<EditorLine[]>([]);
  const [focusedLineIndex,  setFocusedLineIndex]  = useState<number>(-1);
  const [color,             setColor]             = useState<NoteColor>('yellow');
  const [isFavorite,        setIsFavorite]        = useState(false);
  const [isEditing,         setIsEditing]         = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isMaximized,       setIsMaximized]       = useState(false);

  // ── in-note search ──────────────────────────────────────────────────────────
  const [inNoteSearch,     setInNoteSearch]     = useState('');
  const [showInNoteSearch, setShowInNoteSearch] = useState(false);
  const [matchIndex,       setMatchIndex]       = useState(1);
  const [matchCount,       setMatchCount]       = useState(0);
  const inNoteSearchRef = useRef<HTMLInputElement>(null);
  const contentScrollRef = useRef<HTMLDivElement>(null);

  // ── Reset on open ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
      setEditorLines(parseContent(note.content));
      setColor(note.color);
      setIsFavorite(note.isFavorite);
      setIsEditing(false);
      setIsMaximized(false);
      setShowInNoteSearch(false);
      setInNoteSearch('');
      setMatchIndex(1);
      setMatchCount(0);
    }
  }, [note, isOpen]);

  // ── Sync editorLines → content string ──────────────────────────────────────
  const handleEditorChange = (lines: EditorLine[]) => {
    setEditorLines(lines);
    setContent(serializeLines(lines));
  };

  // ── Count matches ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!inNoteSearch.trim()) { setMatchCount(0); setMatchIndex(1); return; }
    const escaped = inNoteSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'gi');
    const matches = (`${title}\n${content}`).match(regex);
    const count = matches ? matches.length : 0;
    setMatchCount(count);
    setMatchIndex(1);
  }, [inNoteSearch, content, title]);

  // ── Scroll to nth <mark> ────────────────────────────────────────────────────
  const scrollToMatch = (idx: number) => {
    const container = contentScrollRef.current;
    if (!container) return;
    const marks = container.querySelectorAll('mark');
    const target = marks[idx - 1] as HTMLElement | undefined;
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  useEffect(() => {
    if (matchCount > 0) setTimeout(() => scrollToMatch(matchIndex), 60);
  }, [matchIndex, matchCount, inNoteSearch]);

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!note || !title.trim()) return;
    onSave(note.id, { title, content, color, isFavorite });
    setIsEditing(false);
  };

  const confirmDelete = () => {
    if (!note) return;
    onDelete(note.id);
    setShowDeleteConfirm(false);
    onClose();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  // ── Toolbar: add a checkbox line at end (or after last focused) ─────────────
  const addCheckboxLine = () => {
    setEditorLines(prev => {
      const next = [...prev, { id: mid(), kind: 'checkbox' as const, text: '', checked: false }];
      setContent(serializeLines(next));
      return next;
    });
  };

  // ── Toolbar: convert focused line to copyable, or append a new one ───────────
  const addCopyableLine = () => {
    setEditorLines(prev => {
      let next: EditorLine[];
      if (focusedLineIndex >= 0 && focusedLineIndex < prev.length) {
        // Convert the currently focused line to copyable (keep its text)
        next = prev.map((l, i) =>
          i === focusedLineIndex
            ? { ...l, kind: 'copyable' as const, copyGroupId: mid() }
            : l
        );
      } else {
        // No line focused — append a new empty copyable line
        next = [...prev, { id: mid(), kind: 'copyable' as const, text: '', copyGroupId: mid() }];
      }
      setContent(serializeLines(next));
      return next;
    });
  };

  // ── Toolbar: all lines share ONE copyGroupId → one single copyable block ──────
  const markAllCopyable = () => {
    setEditorLines(prev => {
      const sharedGid = mid(); // same id for every line → serializes as one [copy-start]…[copy-end]
      const next = prev.map(l => ({ ...l, kind: 'copyable' as const, copyGroupId: sharedGid }));
      setContent(serializeLines(next));
      return next;
    });
  };

  // ── Ctrl+F ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && !isEditing) {
        e.preventDefault();
        setShowInNoteSearch(true);
        setTimeout(() => inNoteSearchRef.current?.focus(), 50);
      }
      if (e.key === 'Escape' && showInNoteSearch) {
        setShowInNoteSearch(false);
        setInNoteSearch('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, isEditing, showInNoteSearch]);

  // ── Sizing ──────────────────────────────────────────────────────────────────
  const modalSizeClass = isMaximized
    ? 'fixed inset-0 rounded-none w-full h-full max-w-none max-h-none'
    : 'relative rounded-3xl w-full max-w-2xl max-h-[85vh]';
  // Always flex-1 so the body fills remaining height and footer is never cut off
  const contentHeightClass = 'flex-1 overflow-y-auto min-h-0';
  const px = isMaximized ? 'px-8' : 'px-6';

  return (
    <>
      <AnimatePresence>
        {isOpen && note && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            variants={backdropVariants}
            initial="hidden" animate="visible" exit="exit"
          >
            {!isMaximized && (
              <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            )}

            <motion.div
              layout
              className={`${colorClasses[color]} ${modalSizeClass} overflow-hidden shadow-2xl z-10 flex flex-col`}
              variants={!isMaximized ? modalVariants : undefined}
              initial={!isMaximized ? 'hidden' : undefined}
              animate={!isMaximized ? 'visible' : undefined}
              exit={!isMaximized ? 'exit' : undefined}
              transition={{ layout: { type: 'spring', stiffness: 300, damping: 30 } }}
            >
              {/* ══ HEADER ══════════════════════════════════════════════════ */}
              <div className={`flex items-center justify-between border-b border-black/10 ${px} py-4 ${isMaximized ? 'shrink-0' : ''}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <motion.button
                    onClick={() => {
                      const nf = !isFavorite;
                      setIsFavorite(nf);
                      if (note) onSave(note.id, { title, content, color, isFavorite: nf });
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all cursor-pointer shrink-0 text-sm font-medium ${
                      isFavorite ? 'bg-black text-yellow-400' : 'bg-black/10 text-black/60 hover:bg-black/20'
                    }`}
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  >
                    <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-yellow-400' : ''}`} />
                    <span>{isFavorite ? 'Favorited' : 'Favorite'}</span>
                  </motion.button>
                  <span className="text-black/50 text-sm truncate hidden sm:block">{formatDate(note.createdAt)}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {!isEditing && (
                    <motion.button
                      onClick={() => {
                        const next = !showInNoteSearch;
                        setShowInNoteSearch(next);
                        if (!next) setInNoteSearch('');
                        else setTimeout(() => inNoteSearchRef.current?.focus(), 50);
                      }}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                        showInNoteSearch ? 'bg-black/70 text-white' : 'bg-black/10 hover:bg-black/20 text-black/60'
                      }`}
                      whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      title="Search inside note (Ctrl+F)"
                    >
                      <Search className="w-4 h-4" />
                    </motion.button>
                  )}
                  {!isEditing && (
                    <motion.button
                      onClick={() => {
                        setEditorLines(parseContent(note.content));
                        setContent(note.content);
                        setIsEditing(true);
                      }}
                      className="w-9 h-9 bg-black/10 hover:bg-black/20 text-black/60 rounded-full flex items-center justify-center transition-colors cursor-pointer"
                      whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      title="Edit note"
                    >
                      <Pencil className="w-4 h-4" />
                    </motion.button>
                  )}
                  <motion.button
                    onClick={() => setIsMaximized(v => !v)}
                    className="w-9 h-9 bg-black hover:bg-black/80 text-white rounded-full flex items-center justify-center transition-colors cursor-pointer"
                    whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                    title={isMaximized ? 'Restore window' : 'Maximize window'}
                  >
                    {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </motion.button>
                  <motion.button
                    onClick={onClose}
                    className="w-9 h-9 bg-black hover:bg-black/80 text-white rounded-full flex items-center justify-center transition-colors cursor-pointer"
                    whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                    title="Close"
                  >
                    <X className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>

              {/* ══ IN-NOTE SEARCH ═══════════════════════════════════════════ */}
              <AnimatePresence>
                {showInNoteSearch && !isEditing && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden border-b border-black/10 shrink-0"
                  >
                    <div className={`flex items-center gap-3 ${px} py-2.5`}>
                      <Search className="w-4 h-4 text-black/40 shrink-0" />
                      <input
                        ref={inNoteSearchRef}
                        type="text"
                        value={inNoteSearch}
                        onChange={e => setInNoteSearch(e.target.value)}
                        placeholder="Search inside this note…"
                        className="flex-1 bg-transparent outline-none text-sm text-[#1a1a1a] placeholder-black/30"
                        onKeyDown={e => {
                          if (e.key === 'Escape') { setShowInNoteSearch(false); setInNoteSearch(''); }
                          if (e.key === 'Enter' && matchCount > 0) {
                            setMatchIndex(i => i < matchCount ? i + 1 : 1);
                          }
                        }}
                      />
                      {inNoteSearch.trim() && (
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-xs text-black/50 font-medium min-w-12 text-center">
                            {matchCount === 0 ? 'No match' : `${matchIndex} / ${matchCount}`}
                          </span>
                          <button onClick={() => setMatchIndex(i => i > 1 ? i - 1 : matchCount)} disabled={matchCount === 0} className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/10 disabled:opacity-30 cursor-pointer" title="Previous"><ChevronUp className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setMatchIndex(i => i < matchCount ? i + 1 : 1)} disabled={matchCount === 0} className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/10 disabled:opacity-30 cursor-pointer" title="Next"><ChevronDown className="w-3.5 h-3.5" /></button>
                          <button onClick={() => { setShowInNoteSearch(false); setInNoteSearch(''); }} className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/10 cursor-pointer text-black/40"><XCircle className="w-4 h-4" /></button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ══ STICKY HEADER AREA: title + toolbar (edit mode only) ══ */}
              {isEditing && (
                <div className={`shrink-0 border-b border-black/10 ${px} pt-4 pb-3`}>
                  {/* Title */}
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Note title…"
                    className="w-full text-2xl font-semibold bg-transparent border-b-2 border-black/20 focus:border-black outline-none py-2 mb-3 text-[#1a1a1a] placeholder-black/30"
                    autoFocus
                    spellCheck={false}
                  />
                  {/* Toolbar — always visible, never scrolls away */}
                  <div className="flex flex-wrap items-center gap-2 bg-black/5 rounded-xl px-3 py-2">
                    <span className="text-[10px] font-bold text-black/35 uppercase tracking-widest mr-1">Add</span>
                    <button
                      onClick={addCheckboxLine}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-white/70 hover:bg-white rounded-lg text-xs font-medium text-black/65 transition-colors cursor-pointer border border-black/10 shadow-sm"
                      title="Add a checkbox item at the bottom"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>Checkbox</span>
                    </button>
                    <button
                      onClick={addCopyableLine}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 rounded-lg text-xs font-medium text-blue-600 transition-colors cursor-pointer border border-blue-200 shadow-sm"
                      title="Click on a line first, then click here to make it copyable. Or adds a new empty copyable line."
                    >
                      <Clipboard className="w-3.5 h-3.5" />
                      <span>Copyable line</span>
                    </button>
                    <button
                      onClick={markAllCopyable}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-white/70 hover:bg-white rounded-lg text-xs font-medium text-black/65 transition-colors cursor-pointer border border-black/10 shadow-sm"
                      title="Make every line in this note one-tap copyable"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>All copyable</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ══ BODY (scrollable) ════════════════════════════════════════ */}
              <div ref={contentScrollRef} className={`${contentHeightClass} ${px} ${isMaximized ? 'py-5' : 'py-4'}`}>
                {isEditing ? (
                  <div className="space-y-4">
                    {/* Rich editor */}
                    <NoteEditor
                      lines={editorLines}
                      onChange={handleEditorChange}
                      isMaximized={isMaximized}
                      onFocusedIndexChange={setFocusedLineIndex}
                    />
                    {/* Color */}
                    <div className="flex items-center gap-3 pt-1">
                      <span className="text-[10px] font-bold text-black/35 uppercase tracking-widest">Color</span>
                      <div className="flex gap-2">
                        {colorOptions.map(({ color: c, class: cls }) => (
                          <motion.button
                            key={c}
                            onClick={() => setColor(c)}
                            className={`w-7 h-7 ${cls} rounded-full cursor-pointer border-2 transition-all ${color === c ? 'border-black scale-110' : 'border-transparent hover:scale-105'}`}
                            whileTap={{ scale: 0.9 }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h2 className={`font-semibold text-[#1a1a1a] mb-4 ${isMaximized ? 'text-4xl' : 'text-3xl'}`}>
                      {note.title}
                    </h2>
                    <NoteContent
                      content={note.content}
                      isEditing={false}
                      onContentChange={newContent => {
                        if (note) onSave(note.id, { title: note.title, content: newContent, color: note.color, isFavorite: note.isFavorite });
                      }}
                      inNoteSearchQuery={inNoteSearch}
                    />
                  </div>
                )}
              </div>

              {/* ══ FOOTER ══════════════════════════════════════════════════ */}
              {isEditing && (
                <div className={`flex items-center justify-between border-t border-black/10 shrink-0 ${px} py-4`}>
                  <motion.button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium cursor-pointer text-sm"
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  >
                    <Trash2 className="w-4 h-4" />Delete
                  </motion.button>
                  <div className="flex gap-2">
                    <motion.button
                      onClick={() => setIsEditing(false)}
                      className="px-5 py-2 text-black/70 hover:bg-black/5 rounded-xl transition-colors font-medium cursor-pointer text-sm"
                      whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    >Cancel</motion.button>
                    <motion.button
                      onClick={handleSave}
                      disabled={!title.trim()}
                      className="px-5 py-2 bg-black text-white rounded-xl hover:bg-black/80 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-sm"
                      whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    >Save Changes</motion.button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Note"
        message="Are you sure you want to delete this note? This action cannot be undone."
        confirmText="Delete" cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        isDanger
      />
    </>
  );
}
