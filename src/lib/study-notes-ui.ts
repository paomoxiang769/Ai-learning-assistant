type StudyNoteForInitialSelection = {
  id: string;
};

export function getInitialStudyNote<T extends StudyNoteForInitialSelection>(
  notes: T[],
  initialNoteId?: string,
) {
  if (!initialNoteId) {
    return null;
  }

  return notes.find((note) => note.id === initialNoteId) ?? null;
}
