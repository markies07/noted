'use client';

import { motion } from 'framer-motion';
import { Note, NoteColor, NoteFormData } from '@/types/note';
import { Star, GripVertical } from 'lucide-react';
import NoteContent from './NoteContent';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface NoteCardProps {
  note: Note;
  onClick: (note: Note, e?: React.MouseEvent) => void;
  onToggleFavorite: (id: string, isFavorite: boolean) => void;
  onSave?: (id: string, data: NoteFormData) => void;
  isSortable?: boolean;
  index: number;
}

const colorOptions: { color: NoteColor; class: string; name: string }[] = [
  { color: 'yellow', class: 'bg-[#FFFFC2]', name: 'Yellow' },
  { color: 'orange', class: 'bg-[#FFD7BE]', name: 'Orange' },
  { color: 'lime', class: 'bg-[#F7FCD4]', name: 'Lime' },
  { color: 'purple', class: 'bg-[#E4D6FF]', name: 'Purple' },
  { color: 'cyan', class: 'bg-[#C5F2F7]', name: 'Cyan' },
];

const colorClasses: Record<NoteColor, string> = {
  yellow: 'bg-[#FFE4A1]',
  orange: 'bg-[#FFB899]',
  lime: 'bg-[#E4F5A1]',
  purple: 'bg-[#C9B3FF]',
  cyan: 'bg-[#7AEFFF]',
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export default function NoteCard({ note, onClick, onToggleFavorite, onSave, isSortable = false, index }: NoteCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: note.id, disabled: !isSortable });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 200ms cubic-bezier(0.2, 0, 0, 1)',
    opacity: isDragging ? 0 : 1, // Hide the original card being dragged as we use DragOverlay
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout={!isDragging && !isSortable}
      {...attributes}
      {...(isSortable ? listeners : {})}
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.9 }}
      transition={{ 
        duration: 0.3,
        delay: index * 0.05,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      onClick={(e) => !isSortable && onClick(note, e)}
      className={`${colorClasses[note.color]} rounded-2xl p-5 h-[260px] flex flex-col relative group ${!isSortable ? 'cursor-pointer hover:shadow-xl transition-shadow duration-300' : 'cursor-grab active:cursor-grabbing shadow-md'}`}
      whileHover={!isSortable ? { scale: 1.02, transition: { duration: 0.2 } } : {}}
      whileTap={!isSortable ? { scale: 0.98 } : {}}
    >
      {isSortable && (
        <div className="absolute top-4 left-4 opacity-40">
          <GripVertical className="w-4 h-4 text-black" />
        </div>
      )}

      {note.isFavorite && (
        <div className="absolute top-4 right-4 w-7 h-7 bg-black rounded-full flex items-center justify-center z-10">
          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
        </div>
      )}
      
      <div className="flex-1 flex flex-col min-h-0">
        <h3 className={`text-[#1a1a1a] text-lg font-medium leading-snug pr-8 line-clamp-2 shrink-0 ${isSortable ? 'pl-6' : ''}`}>
          {note.title}
        </h3>
        {note.content && (
          <div 
            className="mt-2 flex-1 overflow-hidden"
            style={{ 
              maskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)'
            }}
          >
            <NoteContent 
              content={note.content} 
              isEditing={false} 
              onContentChange={(newContent) => {
                if (onSave) {
                  onSave(note.id, {
                    title: note.title,
                    content: newContent,
                    color: note.color,
                    isFavorite: note.isFavorite
                  });
                }
              }} 
              isPreview={true}
            />
          </div>
        )}
      </div>
      
      <div className="pt-4 mt-auto shrink-0">
        <span className="text-[#1a1a1a]/70 text-sm">
          {formatDate(note.createdAt)}
        </span>
      </div>
    </motion.div>
  );
}
