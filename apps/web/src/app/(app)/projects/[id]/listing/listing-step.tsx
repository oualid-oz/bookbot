'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckIcon, CircleAlertIcon, CopyIcon, Loader2Icon, PlusIcon, TriangleAlertIcon } from 'lucide-react';
import { toast } from 'sonner';
import { checkListing, descriptionText, LISTING_LIMITS, type ListingIssue } from '@bookbot/core';
import type { ListingUpdate } from '@bookbot/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from 'cn';
import { CategoryInput } from './category-input';
import { apiFetch } from '@/lib/api-client';

type Listing = Required<ListingUpdate>;

const SLOTS = Array.from({ length: LISTING_LIMITS.keywordSlots }, (_, i) => i);
const CATEGORY_SLOTS = Array.from({ length: LISTING_LIMITS.categories }, (_, i) => i);

/** Fill fixed-size slot arrays so every input is controlled */
const padded = (values: string[], length: number) => Array.from({ length }, (_, i) => values[i] ?? '');

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Copy ${label}`} disabled={!value}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}>
      {copied ? <CheckIcon /> : <CopyIcon />}
    </Button>
  );
}

function Counter({ value, max }: { value: number; max: number }) {
  return <span className={cn('text-xs tabular-nums', value > max ? 'text-destructive' : 'text-muted-foreground')}>{value}/{max}</span>;
}

function Issues({ issues }: { issues: ListingIssue[] }) {
  if (!issues.length) return null;
  return (
    <ul className="flex flex-col gap-1">
      {issues.map((issue, i) => (
        <li key={i} className={cn('flex items-start gap-1.5 text-sm', issue.level === 'error' ? 'text-destructive' : 'text-amber-700 dark:text-amber-400')}>
          {issue.level === 'error' ? <CircleAlertIcon className="mt-0.5 size-4 shrink-0" /> : <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />}
          {issue.message}
        </li>
      ))}
    </ul>
  );
}

/** The Amazon listing, checked against KDP's rules as you type. `onSaved` runs after saving. */
export function ListingStep({ projectId: id, onSaved }: { projectId: string; onSaved?: () => void }) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [saved, setSaved] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<{ listing: Listing; suggestions: string[] }>(`/api/projects/${id}/listing`)
      .then((data) => {
        const loaded = {
          ...data.listing,
          keywords: padded(data.listing.keywords, LISTING_LIMITS.keywordSlots),
          categories: padded(data.listing.categories, LISTING_LIMITS.categories),
        };
        setListing(loaded);
        setSaved(JSON.stringify(loaded));
        setSuggestions(data.suggestions);
      })
      .catch((err) => setError(err.message));
  }, [id]);

  // Same checks as the server, live as you type
  const issues = useMemo(() => (listing ? checkListing(listing) : []), [listing]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!listing) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const update = (changes: Partial<Listing>) => setListing({ ...listing, ...changes });
  const setSlot = (key: 'keywords' | 'categories', index: number, value: string) =>
    update({ [key]: listing[key].map((v, i) => (i === index ? value : v)) });
  const issuesFor = (...fields: ListingIssue['field'][]) => issues.filter((i) => fields.includes(i.field));
  const dirty = JSON.stringify(listing) !== saved;
  const errors = issues.filter((i) => i.level === 'error').length;
  const warnings = issues.length - errors;

  const used = new Set(listing.keywords.map((k) => k.trim().toLowerCase()));
  const freeSlot = listing.keywords.findIndex((k) => !k.trim());
  const unusedSuggestions = suggestions.filter((s) => !used.has(s.toLowerCase()));

  const save = async () => {
    setSaving(true);
    try {
      const body = { ...listing, keywords: listing.keywords.filter((k) => k.trim()), categories: listing.categories.filter((c) => c.trim()) };
      await apiFetch(`/api/projects/${id}/listing`, { method: 'PUT', body });
      setSaved(JSON.stringify(listing));
      toast.success('Listing saved');
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the listing');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">Everything you paste into KDP&apos;s &ldquo;Paperback details&rdquo; page.</p>
        <div className="flex items-center gap-3">
          {errors === 0 && warnings === 0 ? (
            <Badge variant="secondary"><CheckIcon />Ready for KDP</Badge>
          ) : (
            <Badge variant={errors ? 'destructive' : 'outline'}>
              {errors ? `${errors} problem${errors > 1 ? 's' : ''}` : ''}
              {errors && warnings ? ' · ' : ''}
              {warnings ? `${warnings} suggestion${warnings > 1 ? 's' : ''}` : ''}
            </Badge>
          )}
          <Button onClick={save} disabled={saving || !dirty || !listing.title.trim()}>
            {saving && <Loader2Icon className="animate-spin" />}
            Save listing
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Book details</CardTitle>
          <CardDescription>The title and subtitle should match the cover exactly.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="title">Title</FieldLabel>
                <CopyButton value={listing.title} label="title" />
              </div>
              <Input id="title" value={listing.title} maxLength={255} onChange={(e) => update({ title: e.target.value })} />
              <Issues issues={issuesFor('title')} />
            </Field>
            <Field>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="subtitle">Subtitle</FieldLabel>
                <div className="flex items-center gap-1">
                  <Counter value={listing.title.trim().length + listing.subtitle.trim().length} max={LISTING_LIMITS.titleAndSubtitle} />
                  <CopyButton value={listing.subtitle} label="subtitle" />
                </div>
              </div>
              <Input id="subtitle" value={listing.subtitle} maxLength={255} onChange={(e) => update({ subtitle: e.target.value })} />
              <FieldDescription>Title and subtitle share a {LISTING_LIMITS.titleAndSubtitle}-character limit.</FieldDescription>
              <Issues issues={issuesFor('subtitle')} />
            </Field>
            <Field>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="author">Author</FieldLabel>
                <CopyButton value={listing.author} label="author" />
              </div>
              <Input id="author" value={listing.author} maxLength={255} placeholder="Your name or pen name"
                onChange={(e) => update({ author: e.target.value })} />
              <Issues issues={issuesFor('author')} />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Description</CardTitle>
          <CardDescription>
            Shown on the Amazon product page. You can use <code>&lt;b&gt;</code>, <code>&lt;i&gt;</code>, <code>&lt;p&gt;</code>,{' '}
            <code>&lt;br&gt;</code>, <code>&lt;ul&gt;</code>/<code>&lt;li&gt;</code> and <code>&lt;h4&gt;</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Field>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="description">Description</FieldLabel>
              <div className="flex items-center gap-1">
                <Counter value={listing.description.length} max={LISTING_LIMITS.description} />
                <CopyButton value={listing.description} label="description" />
              </div>
            </div>
            <Textarea id="description" rows={10} value={listing.description} className="font-mono text-sm"
              placeholder={'<p>Who is this book for, and why will they love it?</p>\n<ul>\n  <li>What is inside</li>\n</ul>'}
              onChange={(e) => update({ description: e.target.value })} />
            <FieldDescription>{descriptionText(listing.description).trim().split(/\s+/).filter(Boolean).length} words</FieldDescription>
            <Issues issues={issuesFor('description')} />
          </Field>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Keywords</CardTitle>
            <CardDescription>
              Seven search phrases readers might type. Don&apos;t repeat words from your title; Amazon already searches those.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {SLOTS.map((i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-4 text-right text-sm text-muted-foreground">{i + 1}</span>
                <Input aria-label={`Keyword ${i + 1}`} value={listing.keywords[i]} maxLength={100}
                  onChange={(e) => setSlot('keywords', i, e.target.value)} />
                <Counter value={listing.keywords[i].trim().length} max={LISTING_LIMITS.keyword} />
                <CopyButton value={listing.keywords[i]} label={`keyword ${i + 1}`} />
              </div>
            ))}
            <Issues issues={issuesFor('keywords')} />
            {unusedSuggestions.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">From your research</p>
                <div className="flex flex-wrap gap-1.5">
                  {unusedSuggestions.slice(0, 20).map((s) => (
                    <Button key={s} type="button" variant="outline" size="sm" disabled={freeSlot === -1}
                      onClick={() => setSlot('keywords', freeSlot, s)}>
                      <PlusIcon />
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Categories</CardTitle>
            <CardDescription>
              Up to three. Search our list or type your own, then pick the closest match in KDP&apos;s category picker, which has the final say.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {CATEGORY_SLOTS.map((i) => (
              <CategoryInput key={i} label={`Category ${i + 1}`} value={listing.categories[i]}
                exclude={listing.categories.filter((c, j) => j !== i && c.trim())}
                placeholder={i === 0 ? 'Search, e.g. word search or journal' : ''}
                onChange={(value) => setSlot('categories', i, value)} />
            ))}
            <Issues issues={issuesFor('categories')} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
