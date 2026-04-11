'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Note, NoteColor, NoteFormData } from '@/types/note';
import { X, Star, Trash2, CheckSquare } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import NoteContent from './NoteContent';

interface NoteModalProps {
  note: Note | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, data: NoteFormData) => void;
  onDelete: (id: string) => void;
}

const colorOptions: { color: NoteColor; class: string; name: string }[] = [
  { color: 'yellow', class: 'bg-[#FFE4A1]', name: 'Yellow' },
  { color: 'orange', class: 'bg-[#FFB899]', name: 'Orange' },
  { color: 'lime', class: 'bg-[#E4F5A1]', name: 'Lime' },
  { color: 'purple', class: 'bg-[#C9B3FF]', name: 'Purple' },
  { color: 'cyan', class: 'bg-[#7AEFFF]', name: 'Cyan' },
];

const colorClasses: Record<NoteColor, string> = {
  yellow: 'bg-[#FFE4A1]',
  orange: 'bg-[#FFB899]',
  lime: 'bg-[#E4F5A1]',
  purple: 'bg-[#C9B3FF]',
  cyan: 'bg-[#7AEFFF]',
};

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

const modalVariants = {
  hidden: { 
    opacity: 0, 
    scale: 0.8,
    y: 50,
  },
  visible: { 
    opacity: 1, 
    scale: 1,
    y: 0,
    transition: { 
      type: 'spring' as const,
      stiffness: 300,
      damping: 25,
      delay: 0.1,
    },
  },
  exit: { 
    opacity: 0, 
    scale: 0.9,
    y: 30,
    transition: { duration: 0.2 },
  },
};

export default function NoteModal({ note, isOpen, onClose, onSave, onDelete }: NoteModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [color, setColor] = useState<NoteColor>('yellow');
  const [isFavorite, setIsFavorite] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
      setColor(note.color);
      setIsFavorite(note.isFavorite);
      setIsEditing(false);
    }
  }, [note, isOpen]);

  const handleSave = () => {
    if (!note || !title.trim()) return;
    onSave(note.id, { title, content, color, isFavorite });
    setIsEditing(false);
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
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
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
    <AnimatePresence>
      {isOpen && note && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <motion.div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          
          <motion.div
            className={`relative ${colorClasses[color]} rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl`}
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="flex items-center justify-between p-6 border-b border-black/10">
              <div className="flex items-center gap-3">
                <motion.button
                  onClick={() => {
                    const newFavorite = !isFavorite;
                    setIsFavorite(newFavorite);
                    if (note) {
                      onSave(note.id, { title, content, color, isFavorite: newFavorite });
                    }
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all cursor-pointer ${
                    isFavorite 
                      ? 'bg-black text-yellow-400' 
                      : 'bg-black/10 text-black/70 hover:bg-black/20'
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Star className={`w-4 h-4 ${isFavorite ? 'fill-yellow-400' : ''}`} />
                  <span className="text-sm font-medium">
                    {isFavorite ? 'Favorited' : 'Favorite'}
                  </span>
                </motion.button>
                
                <span className="text-black/60 text-sm">
                  {formatDate(note.createdAt)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {!isEditing && (
                  <motion.button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-black text-white rounded-full text-sm font-medium hover:bg-black/80 transition-colors cursor-pointer"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Edit
                  </motion.button>
                )}
                
                <motion.button
                  onClick={onClose}
                  className="w-10 h-10 bg-black rounded-full flex items-center justify-center hover:bg-black/80 transition-colors cursor-pointer"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X className="w-5 h-5 text-white" />
                </motion.button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {isEditing ? (
                <div className="space-y-4">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Note title..."
                    className="w-full text-2xl font-semibold bg-transparent border-b-2 border-black/20 focus:border-black outline-none py-2 text-[#1a1a1a] placeholder-black/30"
                    autoFocus
                    spellCheck="false"
                  />
                  
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Add your note content here..."
                      rows={6}
                      className="w-full text-lg bg-transparent border-none outline-none resize-none text-[#1a1a1a] placeholder-black/30"
                      spellCheck="false"
                      id="note-textarea"
                    />

                    <div className="flex items-center gap-4 pt-2">
                      <button
                        onClick={() => {
                          const textarea = document.getElementById('note-textarea') as HTMLTextAreaElement;
                          if (!textarea) return;
                          
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const text = textarea.value;
                          const lines = text.split('\n');
                          
                          // Find which line the cursor is on
                          let currentPos = 0;
                          let lineIndex = 0;
                          for (let i = 0; i < lines.length; i++) {
                            if (currentPos <= start && start <= currentPos + lines[i].length) {
                              lineIndex = i;
                              break;
                            }
                            currentPos += lines[i].length + 1;
                          }
                          
                          const line = lines[lineIndex];
                          if (line.trim().startsWith('[ ]') || line.trim().startsWith('- [ ]')) {
                            // Already has checkbox, maybe do nothing or remove it
                          } else {
                            lines[lineIndex] = `- [ ] ${line}`;
                            const newContent = lines.join('\n');
                            setContent(newContent);
                            
                            // Return focus to textarea
                            setTimeout(() => {
                              textarea.focus();
                              const newCursorPos = start + 6;
                              textarea.setSelectionRange(newCursorPos, newCursorPos);
                            }, 0);
                          }
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-black/5 hover:bg-black/10 rounded-lg text-sm font-medium text-black/70 transition-colors"
                        title="Add Checkbox"
                      >
                        <CheckSquare className="w-4 h-4" />
                        <span>Checkbox</span>
                      </button>
                    </div>

                    <div className="pt-4">
                      <label htmlFor="color-picker" className="text-sm font-medium text-black/60 mb-3 block">
                        Note Color
                      </label>
                    <div className="flex gap-3">
                      {colorOptions.map(({ color: c, class: colorClass }) => (
                        <motion.button
                          key={c}
                          onClick={() => setColor(c)}
                          className={`w-10 h-10 ${colorClass} rounded-full cursor-pointer ${
                            color === c ? 'ring-2 ring-offset-2 ring-black' : ''
                          }`}
                          whileHover={{ scale: 1.15 }}
                          whileTap={{ scale: 0.9 }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <h2 className="text-3xl font-semibold text-[#1a1a1a] mb-4">
                    {note.title}
                  </h2>
                  <NoteContent 
                    content={note.content} 
                    isEditing={false} 
                    onContentChange={(newContent) => {
                      if (note) {
                        onSave(note.id, { 
                          title: note.title,
                          content: newContent,
                          color: note.color,
                          isFavorite: note.isFavorite 
                        });
                      }
                    }} 
                  />
                </div>
              )}
            </div>

            {isEditing && (
              <div className="flex items-center justify-between p-6 border-t border-black/10">
                <motion.button
                  onClick={handleDeleteClick}
                  className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium cursor-pointer"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </motion.button>

                <div className="flex gap-3">
                  <motion.button
                    onClick={() => setIsEditing(false)}
                    className="px-6 py-2.5 text-black/70 hover:bg-black/5 rounded-xl transition-colors font-medium cursor-pointer"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    onClick={handleSave}
                    disabled={!title.trim()}
                    className="px-6 py-2.5 bg-black text-white rounded-xl hover:bg-black/80 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Save Changes
                  </motion.button>
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
      confirmText="Delete"
      cancelText="Cancel"
      onConfirm={confirmDelete}
      onCancel={() => setShowDeleteConfirm(false)}
      isDanger
    />
    </>
  );
}
