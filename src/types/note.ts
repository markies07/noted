export type NoteColor = 'yellow' | 'orange' | 'lime' | 'purple' | 'cyan';

export interface Note {
  id: string;
  title: string;
  content: string;
  color: NoteColor;
  isFavorite: boolean;
  order?: number;
  createdAt: string;
  updatedAt: string;
}

export interface NoteFormData {
  title: string;
  content: string;
  color: NoteColor;
  isFavorite: boolean;
  order?: number;
}
