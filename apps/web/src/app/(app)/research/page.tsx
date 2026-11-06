import { SavedBooks } from './saved-books';

export default function ResearchPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Research</h1>
        <p className="text-muted-foreground">The books you&apos;re studying, saved from Amazon with the Chrome extension.</p>
      </div>

      <SavedBooks />
    </div>
  );
}
