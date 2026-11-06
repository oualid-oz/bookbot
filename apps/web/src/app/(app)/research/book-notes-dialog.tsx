'use client';

import { useState } from 'react';
import { Loader2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ApiError, apiFetch } from '@/lib/api-client';
import type { SavedBook } from './saved-books';

/** Edit your notes and tags on a book; rendered only while a book is being edited */
export function BookNotesDialog({ book, onClose, onSaved }: { book: SavedBook; onClose: () => void; onSaved: (book: SavedBook) => void }) {
  const [notes, setNotes] = useState(book.notes);
  const [tags, setTags] = useState(book.tags.join(', '));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { book: saved } = await apiFetch<{ book: Omit<SavedBook, 'history'> }>(`/api/books/${book.id}`, {
        method: 'PATCH',
        body: { notes, tags: tags.split(',').map((t) => t.trim()).filter(Boolean) },
      });
      onSaved({ ...book, ...saved });
    } catch (err) {
      setError(err instanceof ApiError ? (err.fields.notes?.[0] ?? err.fields.tags?.[0] ?? err.message) : 'Could not save');
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={save} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Notes and tags</DialogTitle>
            <DialogDescription className="line-clamp-2">{book.title}</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="book-notes">Notes</FieldLabel>
              <Textarea id="book-notes" rows={5} maxLength={2000} value={notes} placeholder="What works about this book? What would you do differently?"
                onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="book-tags">Tags</FieldLabel>
              <Input id="book-tags" value={tags} placeholder="competitor, cover idea, winter" onChange={(e) => setTags(e.target.value)} />
              <FieldDescription>Separate with commas. Saving the book again from Amazon keeps your notes and tags.</FieldDescription>
            </Field>
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2Icon className="animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
