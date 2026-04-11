'use client';

import { useState } from 'react';
import { Plus, X, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { NoteColor } from '@/types/note';
import ConfirmDialog from './ConfirmDialog';

interface SidebarProps {
  onColorSelect: (color: NoteColor) => void;
  onLogout: () => void;
}

const colorOptions: { color: NoteColor; class: string; name: string }[] = [
  { color: 'yellow', class: 'bg-[#FFE4A1]', name: 'Yellow' },
  { color: 'orange', class: 'bg-[#FFB899]', name: 'Orange' },
  { color: 'lime', class: 'bg-[#E4F5A1]', name: 'Lime' },
  { color: 'purple', class: 'bg-[#C9B3FF]', name: 'Purple' },
  { color: 'cyan', class: 'bg-[#7AEFFF]', name: 'Cyan' },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.03,
      staggerDirection: -1,
    },
  },
};

const itemVariants = {
  hidden: { 
    opacity: 0, 
    y: -20,
    scale: 0.8,
  },
  visible: { 
    opacity: 1, 
    y: 0,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 400,
      damping: 20,
    },
  },
  exit: { 
    opacity: 0, 
    y: -10,
    scale: 0.8,
    transition: {
      duration: 0.2,
    },
  },
};

export default function Sidebar({ onColorSelect, onLogout }: SidebarProps) {
  const [showColors, setShowColors] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleColorClick = (color: NoteColor) => {
    onColorSelect(color);
    setShowColors(false);
  };

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    onLogout();
  };

  return (
    <aside className="w-20 bg-white border-r border-gray-100 flex flex-col items-center py-6 fixed left-0 top-0 h-screen z-20">
      <div className="mb-8">
        <span className="text-xl font-extrabold text-[#1a1a1a] cursor-default">NTD.</span>
      </div>

      <div className="relative">
        <motion.button
          onClick={() => setShowColors(!showColors)}
          className="w-12 h-12 bg-[#1a1a1a] rounded-full flex items-center justify-center shadow-lg cursor-pointer"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          animate={{ rotate: showColors ? 45 : 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          {showColors ? (
            <X className="w-6 h-6 text-white" />
          ) : (
            <Plus className="w-6 h-6 text-white" />
          )}
        </motion.button>

        <AnimatePresence>
          {showColors && (
            <motion.div
              className="absolute top-full left-1/2 -translate-x-1/2 mt-4 flex flex-col gap-3"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {colorOptions.map(({ color, class: colorClass, name }) => (
                <motion.button
                  key={color}
                  onClick={() => handleColorClick(color)}
                  className={`w-6 h-6 ${colorClass} rounded-full shadow-md cursor-pointer`}
                  variants={itemVariants}
                  whileHover={{ scale: 1.15, transition: { duration: 0.2 } }}
                  whileTap={{ scale: 0.9 }}
                  title={`Create ${name} note`}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Logout Button at Bottom */}
      <div className="mt-auto mb-4">
        <motion.button
          onClick={handleLogoutClick}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors cursor-pointer"
          title="Logout"
        >
          <LogOut className="w-5 h-5 text-gray-600" />
        </motion.button>
      </div>

      <ConfirmDialog
        isOpen={showLogoutConfirm}
        title="Logout"
        message="Are you sure you want to logout?"
        confirmText="Logout"
        cancelText="Cancel"
        onConfirm={confirmLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </aside>
  );
}
