import React, { useState } from 'react';
import type { Note } from '../types';

interface NotesPanelProps {
  notes: Note[];
  setNotes: React.Dispatch<React.SetStateAction<Note[]>>;
}

const NotesPanel: React.FC<NotesPanelProps> = ({ notes, setNotes }) => {
  const [currentNote, setCurrentNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  const handleSaveNote = () => {
    if (!currentNote.trim()) return;

    if (editingNoteId) {
      setNotes(notes.map(n => n.id === editingNoteId ? { ...n, content: currentNote, timestamp: Date.now() } : n));
    } else {
      const newNote: Note = {
        id: `note-${Date.now()}`,
        content: currentNote,
        timestamp: Date.now(),
      };
      setNotes([newNote, ...notes]);
    }
    setCurrentNote('');
    setEditingNoteId(null);
  };

  const handleEditNote = (note: Note) => {
    setEditingNoteId(note.id);
    setCurrentNote(note.content);
  };

  const handleDeleteNote = (id: string) => {
    setNotes(notes.filter(n => n.id !== id));
    if (id === editingNoteId) {
      setCurrentNote('');
      setEditingNoteId(null);
    }
  };
  
  const handleCancelEdit = () => {
    setCurrentNote('');
    setEditingNoteId(null);
  }

  return (
    <div className="h-full flex flex-col max-w-4xl mx-auto w-full p-4 text-gray-200">
      <h2 className="text-2xl font-bold mb-4">My Notes</h2>
      <div className="bg-slate-800/40 p-4 rounded-lg shadow-inner mb-4">
        <textarea
          value={currentNote}
          onChange={(e) => setCurrentNote(e.target.value)}
          placeholder="Jot down your thoughts and inspirations..."
          className="w-full h-32 p-2 bg-slate-700/50 rounded-md border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <div className="flex justify-end mt-2 space-x-2">
           {editingNoteId && (
            <button onClick={handleCancelEdit} className="px-4 py-2 bg-slate-600 rounded-md hover:bg-slate-500 transition-colors">
              Cancel
            </button>
          )}
          <button onClick={handleSaveNote} className="px-4 py-2 bg-blue-600 rounded-md hover:bg-blue-700 transition-colors">
            {editingNoteId ? 'Save Changes' : 'Add Note'}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto space-y-3">
        {notes.length === 0 ? (
            <p className="text-center text-gray-400 mt-8">You don't have any notes yet.</p>
        ) : (
            notes.map(note => (
            <div key={note.id} className="bg-slate-800/40 p-3 rounded-lg group">
                <p className="whitespace-pre-wrap">{note.content}</p>
                <div className="text-xs text-gray-400 mt-2 flex justify-between items-center">
                <span>{new Date(note.timestamp).toLocaleString()}</span>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity space-x-2">
                    <button onClick={() => handleEditNote(note)} className="hover:text-white">Edit</button>
                    <button onClick={() => handleDeleteNote(note.id)} className="hover:text-red-400">Delete</button>
                </div>
                </div>
            </div>
            ))
        )}
      </div>
    </div>
  );
};

export default NotesPanel;