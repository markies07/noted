import { Note, NoteFormData } from '@/types/note';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

const NOTES_COLLECTION = 'notes';

const convertTimestamp = (timestamp: any): string => {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate().toISOString();
  }
  if (typeof timestamp === 'string') {
    return timestamp;
  }
  return new Date().toISOString();
};

export const notesService = {
  async getAllNotes(userId: string): Promise<Note[]> {
    try {
      const q = query(
        collection(db, NOTES_COLLECTION),
        where('userId', '==', userId)
      );
      const snapshot = await getDocs(q);
      const notes = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          title: data.title,
          content: data.content,
          color: data.color,
          isFavorite: data.isFavorite ?? false,
          order: data.order ?? 0,
          createdAt: convertTimestamp(data.createdAt),
          updatedAt: convertTimestamp(data.updatedAt),
        } as Note;
      });
      // Sort in memory instead of using orderBy to avoid composite index requirement
      return notes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } catch (error) {
      console.error('Error fetching notes from Firebase:', error);
      throw error;
    }
  },

  async createNote(data: NoteFormData, userId: string): Promise<Note> {
    const now = new Date().toISOString();
    const noteData = {
      ...data,
      userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      const docRef = await addDoc(collection(db, NOTES_COLLECTION), noteData);
      return {
        id: docRef.id,
        ...data,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      console.error('Error creating note in Firebase:', error);
      throw error;
    }
  },

  async updateNote(id: string, data: Partial<NoteFormData>): Promise<void> {
    try {
      const noteRef = doc(db, NOTES_COLLECTION, id);
      await updateDoc(noteRef, {
        ...data,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating note in Firebase:', error);
      throw error;
    }
  },

  async deleteNote(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, NOTES_COLLECTION, id));
    } catch (error) {
      console.error('Error deleting note from Firebase:', error);
      throw error;
    }
  },

  async toggleFavorite(id: string, isFavorite: boolean): Promise<void> {
    return this.updateNote(id, { isFavorite });
  },

  async updateNotesOrder(notes: { id: string; order: number }[]): Promise<void> {
    const promises = notes.map((note) => {
      const noteRef = doc(db, NOTES_COLLECTION, note.id);
      return updateDoc(noteRef, {
        order: note.order,
        updatedAt: serverTimestamp(),
      });
    });
    try {
      await Promise.all(promises);
    } catch (error) {
      console.error('Error updating notes order in Firebase:', error);
      throw error;
    }
  },
};
