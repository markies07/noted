'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface NoteContentProps {
  content: string;
  isEditing: boolean;
  onContentChange: (newContent: string) => void;
  isPreview?: boolean;
}

export default function NoteContent({ content, isEditing, onContentChange, isPreview = false }: NoteContentProps) {
  if (!content) {
    return <p className="text-lg text-[#1a1a1a]/40 italic">No content added...</p>;
  }

  const toggleCheckbox = (lineIndex: number) => {
    const lines = content.split('\n');
    const line = lines[lineIndex];
    
    // Patterns to match: "- [ ]", "- [x]", "[ ]", "[x]"
    const checkboxRegex = /^(\s*(-?\s*))\[([ xX])\]/;
    const match = line.match(checkboxRegex);
    
    if (match) {
      const currentStatus = match[3];
      const newStatus = currentStatus === ' ' ? 'x' : ' ';
      lines[lineIndex] = line.replace(/\[([ xX])\]/, `[${newStatus}]`);
      onContentChange(lines.join('\n'));
    }
  };

  if (isEditing) {
    // In editing mode, we don't render interactive checkboxes because 
    // it would conflict with the textarea. textarea is managed by the parent.
    return null;
  }

  const lines = content.split('\n');
  
  return (
    <div className={`space-y-1.5 ${isPreview ? 'py-0' : 'py-2'}`}>
      {lines.map((line, index) => {
        // Matches:
        // 1: prefix (spaces, bullet points, etc.)
        // 2: checkbox status (space or x)
        // 3: the rest of the text
        const checkboxRegex = /^(\s*(-?\s*))\[([ xX])\]\s*(.*)/;
        const match = line.match(checkboxRegex);

        if (match) {
          const isChecked = match[3].toLowerCase() === 'x';
          const text = match[4];

          return (
            <div 
              key={index} 
              className={`group flex items-start gap-3 ${isPreview ? 'py-0' : 'py-0.5'}`}
            >
              <div className={`flex items-center shrink-0 ${isPreview ? 'h-5' : 'h-7'}`}>
                <div 
                  className={`relative flex items-center justify-center ${isPreview ? 'w-4 h-4' : 'w-5 h-5'} cursor-pointer`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCheckbox(index);
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    readOnly
                    className={`appearance-none rounded-md border-2 transition-all duration-200 ease-out cursor-pointer ${
                      isPreview ? 'w-4 h-4 border-black/10' : 'w-5 h-5 border-black/20'
                    } bg-transparent checked:bg-black checked:border-black hover:border-black/40 active:scale-95`}
                  />
                  {isChecked && (
                    <motion.svg
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className={`absolute ${isPreview ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'} text-white pointer-events-none`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={4}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </motion.svg>
                  )}
                </div>
              </div>
              <span 
                className={`transition-all duration-300 ${isPreview ? 'text-sm leading-5 py-0 text-[#1a1a1a]/60' : 'text-lg leading-7 py-0.5 text-[#1a1a1a]/90'}`}
                onClick={(e) => {
                  if (isPreview) return; // In preview mode, clicking text should probably open the modal, not toggle
                  toggleCheckbox(index);
                }}
                style={{ cursor: isPreview ? 'inherit' : 'pointer' }}
              >
                {text || <span className="invisible">Empty line</span>}
              </span>
            </div>
          );
        }

        return (
          <p 
            key={index} 
            className={`${isPreview ? 'text-sm text-[#1a1a1a]/60 leading-relaxed min-h-[1.25rem] py-0' : 'text-lg text-[#1a1a1a]/80 leading-relaxed min-h-[1.75rem] py-0.5'} whitespace-pre-wrap`}
          >
            {line || ' '}
          </p>
        );
      })}
    </div>
  );
}
