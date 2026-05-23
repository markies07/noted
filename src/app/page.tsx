'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ChevronDown, GripVertical, Move } from 'lucide-react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import Sidebar from '@/components/Sidebar';
import NoteCard from '@/components/NoteCard';
import NoteModal from '@/components/NoteModal';
import { notesService } from '@/lib/notesService';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Note, NoteColor, NoteFormData } from '@/types/note';

type SortOption = 'custom' | 'newest' | 'oldest' | 'favorites';

export default function Home() {
  const { user, loading: authLoading, logout } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('custom');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReordering, setIsReordering] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const noteCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Click outside handler for sort dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setShowSortDropdown(false);
      }
    };

    if (showSortDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSortDropdown]);

  const loadNotes = useCallback(async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      const fetchedNotes = await notesService.getAllNotes(user.uid);
      setNotes(fetchedNotes);
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    let result = notes;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (note) =>
          note.title.toLowerCase().includes(query) ||
          note.content.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    switch (sortBy) {
      case 'custom':
        result = [...result].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        break;
      case 'newest':
        result = [...result].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        break;
      case 'oldest':
        result = [...result].sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
        break;
      case 'favorites':
        result = [...result].sort((a, b) => {
          if (a.isFavorite === b.isFavorite) {
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
          }
          return a.isFavorite ? -1 : 1;
        });
        break;
    }

    setFilteredNotes(result);
  }, [notes, searchQuery, sortBy]);

  // Scroll to the first matching note when search query changes
  useEffect(() => {
    if (!searchQuery.trim() || filteredNotes.length === 0) return;
    const firstNote = filteredNotes[0];
    const el = noteCardRefs.current[firstNote.id];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [searchQuery, filteredNotes]);

  const handleColorSelect = async (color: NoteColor) => {
    if (!user) return;
    try {
      await notesService.createNote({
        title: 'New Note',
        content: '',
        color,
        isFavorite: false,
      }, user.uid);
      await loadNotes();
      showToast('Note created successfully!', 'success');
    } catch (error) {
      console.error('Error creating note:', error);
      showToast('Failed to create note', 'error');
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleNoteClick = (note: Note, e?: React.MouseEvent) => {
    if (e) {
      const target = e.target as HTMLElement;
      if (target.closest('button')) return;
    }
    setSelectedNote(note);
    setIsModalOpen(true);
  };

  const handleSaveNote = async (id: string, data: NoteFormData) => {
    try {
      await notesService.updateNote(id, data);
      await loadNotes();
      // Update selectedNote with new data so view mode shows immediately
      if (selectedNote && selectedNote.id === id) {
        setSelectedNote({ ...selectedNote, ...data, updatedAt: new Date().toISOString() });
      }
      showToast('Note saved successfully!', 'success');
    } catch (error) {
      console.error('Error saving note:', error);
      showToast('Failed to save note', 'error');
    }
  };

  const handleDeleteNote = async (id: string) => {
    try {
      await notesService.deleteNote(id);
      await loadNotes();
      showToast('Note deleted successfully!', 'success');
    } catch (error) {
      console.error('Error deleting note:', error);
      showToast('Failed to delete note', 'error');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const note = filteredNotes.find((n) => n.id === active.id);
    if (note) setActiveNote(note);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveNote(null);
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = filteredNotes.findIndex((n) => n.id === active.id);
      const newIndex = filteredNotes.findIndex((n) => n.id === over.id);

      const newOrderedNotes = arrayMove(filteredNotes, oldIndex, newIndex);
      
      // Update local state for immediate feedback
      setFilteredNotes(newOrderedNotes);
      setSortBy('custom');

      // Prepare bulk update for Firebase
      const updates = newOrderedNotes.map((note, index) => ({
        id: note.id,
        order: index,
      }));

      try {
        await notesService.updateNotesOrder(updates);
        // Refresh full notes state from server to be sure
        await loadNotes();
      } catch (error) {
        console.error('Failed to update notes order:', error);
        showToast('Failed to save arrangement', 'error');
      }
    }
  };

  const handleToggleFavorite = async (id: string, isFavorite: boolean) => {
    try {
      await notesService.toggleFavorite(id, isFavorite);
      await loadNotes();
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white">
      <Sidebar onColorSelect={handleColorSelect} onLogout={handleLogout} />

      {!hasMounted ? (
        <div className="ml-20 flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      ) : (
        <main className="ml-20 min-h-screen">
          <div className="max-w-none mx-8 py-8">
            <div className="flex items-center justify-between gap-6 mb-12">
              <div className="flex-1 max-w-md">
                <div className={`relative flex items-center rounded-xl transition-all duration-200 ${searchQuery ? 'bg-yellow-50 ring-2 ring-yellow-300' : 'bg-gray-100 focus-within:bg-gray-50 focus-within:ring-2 focus-within:ring-gray-200'}`}>
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search notes… (highlights matching cards)"
                    className="w-full pl-12 pr-10 py-3 bg-transparent border-none focus:outline-none text-gray-700 placeholder-gray-400 transition-all duration-200"
                    onKeyDown={(e) => { if (e.key === 'Escape') setSearchQuery(''); }}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-gray-300 hover:bg-gray-400 transition-colors cursor-pointer"
                      title="Clear search (Esc)"
                    >
                      <span className="text-gray-600 text-xs font-bold leading-none">✕</span>
                    </button>
                  )}
                </div>
                {searchQuery && filteredNotes.length > 0 && (
                  <p className="text-xs text-yellow-600 mt-1.5 ml-1 font-medium">
                    {filteredNotes.length} note{filteredNotes.length !== 1 ? 's' : ''} found — scrolled to first match
                  </p>
                )}
              </div>

              <div className="flex items-center gap-4">
                {sortBy === 'custom' && (
                  <motion.button
                    onClick={() => setIsReordering(!isReordering)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all text-sm font-medium cursor-pointer ${
                      isReordering 
                        ? 'bg-black text-white shadow-lg' 
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    title={isReordering ? "Done reordering" : "Reorder notes"}
                  >
                    <Move className={`w-4 h-4 ${isReordering ? 'animate-pulse' : ''}`} />
                    {isReordering ? 'Done' : 'Reorder'}
                  </motion.button>
                )}

                {/* Sort Dropdown */}
                <div className="relative" ref={sortDropdownRef}>
                <motion.button
                  onClick={() => setShowSortDropdown(!showSortDropdown)}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors text-sm font-medium cursor-pointer"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {sortBy === 'custom' && 'Custom'}
                  {sortBy === 'newest' && 'Newest first'}
                  {sortBy === 'oldest' && 'Oldest first'}
                  {sortBy === 'favorites' && 'Favorites first'}
                  <ChevronDown className="w-4 h-4" />
                </motion.button>
                
                <AnimatePresence>
                  {showSortDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-lg border border-gray-100 py-2 min-w-[160px] z-30"
                    >
                      <button
                        onClick={() => { setSortBy('custom'); setShowSortDropdown(false); }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors cursor-pointer ${sortBy === 'custom' ? 'font-medium text-[#1a1a1a]' : 'text-gray-600'}`}
                      >
                        Custom
                      </button>
                      <button
                        onClick={() => { setSortBy('newest'); setShowSortDropdown(false); }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors cursor-pointer ${sortBy === 'newest' ? 'font-medium text-[#1a1a1a]' : 'text-gray-600'}`}
                      >
                        Newest first
                      </button>
                      <button
                        onClick={() => { setSortBy('oldest'); setShowSortDropdown(false); }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors cursor-pointer ${sortBy === 'oldest' ? 'font-medium text-[#1a1a1a]' : 'text-gray-600'}`}
                      >
                        Oldest first
                      </button>
                      <button
                        onClick={() => { setSortBy('favorites'); setShowSortDropdown(false); }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors cursor-pointer ${sortBy === 'favorites' ? 'font-medium text-[#1a1a1a]' : 'text-gray-600'}`}
                      >
                        Favorites first
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
                </div>
              </div>
            </div>

            <h1 className="text-4xl font-semibold text-[#1a1a1a] mb-8">Notes</h1>

            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-500 text-lg">
                  {searchQuery
                    ? 'No notes found matching your search'
                    : 'No notes yet. Click the + button to create one!'}
                </p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={filteredNotes.map((n) => n.id)}
                  strategy={rectSortingStrategy}
                >
                  <div 
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                  >
                    <AnimatePresence mode="popLayout" initial={false}>
                      {filteredNotes.map((note, index) => (
                        <div
                          key={note.id}
                          ref={(el) => { noteCardRefs.current[note.id] = el; }}
                          className={`rounded-2xl transition-all duration-300 ${
                            searchQuery.trim()
                              ? 'ring-2 ring-yellow-400 ring-offset-2 shadow-lg shadow-yellow-200/60'
                              : ''
                          }`}
                        >
                          <NoteCard
                            note={note}
                            onClick={handleNoteClick}
                            onToggleFavorite={handleToggleFavorite}
                            onSave={handleSaveNote}
                            index={index}
                            isSortable={isReordering}
                          />
                        </div>
                      ))}
                    </AnimatePresence>
                  </div>
                </SortableContext>

                <DragOverlay adjustScale={true}>
                  {activeNote ? (
                    <div className="w-[300px] pointer-events-none opacity-80 cursor-grabbing">
                      <NoteCard
                        note={activeNote}
                        onClick={() => {}}
                        onToggleFavorite={() => {}}
                        index={0}
                        isSortable={true}
                      />
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            )}
          </div>
        </main>
      )}

      <NoteModal
        note={selectedNote}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setTimeout(() => setSelectedNote(null), 300);
        }}
        onSave={handleSaveNote}
        onDelete={handleDeleteNote}
        searchQuery={searchQuery}
      />
    </div>
  );
}
