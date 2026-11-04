'use client';

import { useEffect, useState } from 'react';
import { Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { printColor } from '@bookbot/core';
import { PAGE_TEMPLATES, type InteriorSettings, type PageTemplate } from '@bookbot/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldSeparator } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { apiFetch } from '@/lib/api-client';
import type { ProjectSummary } from '@/components/project-options';
import type { UploadedImage } from './cover/image-field';
import { PageDesignFields, PageDesignPreview } from './page-design';
import { cssFamily, FontFaces, TypographyFields, TypographySample } from './typography-fields';

const TEMPLATE_NAMES: Record<PageTemplate, string> = {
  blank: 'Blank',
  lined: 'Lined',
  dotted: 'Dot grid',
  grid: 'Graph paper',
  gratitude: 'Gratitude journal',
  daily_planner: 'Daily planner',
};

export function InteriorCard({ project, onSaved }: { project: ProjectSummary; onSaved?: () => void }) {
  const [settings, setSettings] = useState<InteriorSettings | null>(null);
  const [saved, setSaved] = useState('');
  const [saving, setSaving] = useState(false);
  const [image, setImage] = useState<UploadedImage | null>(null);

  useEffect(() => {
    apiFetch<{ settings: InteriorSettings; image: UploadedImage | null }>(`/api/projects/${project.id}/interior`)
      .then(({ settings, image }) => {
        setSettings(settings);
        setSaved(JSON.stringify(settings));
        setImage(image);
      })
      .catch((err) => toast.error(err.message));
  }, [project.id]);

  if (!settings) return <Skeleton className="h-64 rounded-xl" />;

  const update = (changes: Partial<InteriorSettings>) => setSettings({ ...settings, ...changes });
  const updateDecor = (changes: Partial<InteriorSettings['decor']>) => update({ decor: { ...settings.decor, ...changes } });
  const updateTypography = (changes: Partial<InteriorSettings['typography']>) =>
    update({ typography: { ...settings.typography, ...changes } });
  const isJournal = project.type === 'journal';
  const template = settings.pageTemplate ?? (isJournal ? 'lined' : 'blank');
  const ruled = ['lined', 'gratitude', 'daily_planner'].includes(template);

  const save = async () => {
    setSaving(true);
    try {
      const result = await apiFetch<{ settings: InteriorSettings }>(`/api/projects/${project.id}/interior`, {
        method: 'PUT',
        body: settings,
      });
      setSaved(JSON.stringify(result.settings));
      toast.success('Interior settings saved. Export the interior to see them.');
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const toggle = (id: keyof InteriorSettings, label: string, description: string, checked: boolean, onChange: (v: boolean) => void) => (
    <Field orientation="horizontal">
      <FieldContent>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <FieldDescription>{description}</FieldDescription>
      </FieldContent>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </Field>
  );

  const dirty = JSON.stringify(settings) !== saved;
  const headingColor = printColor(settings.typography.headingColor, project.paper === 'color');

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <FontFaces />
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Pages</CardTitle>
            <CardDescription>
              {isJournal ? 'The style of every page in the journal.' : `What goes in the book besides the puzzles, up to ${project.pageCount} pages.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="page-template">{isJournal ? 'Page style' : 'Extra pages'}</FieldLabel>
                  <Select value={template} onValueChange={(value) => update({ pageTemplate: value as PageTemplate })}>
                    <SelectTrigger id="page-template" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAGE_TEMPLATES.map((t) => <SelectItem key={t} value={t}>{TEMPLATE_NAMES[t]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                {ruled && (
                  <Field>
                    <FieldLabel htmlFor="line-spacing">Line spacing</FieldLabel>
                    <Select value={settings.lineSpacing} onValueChange={(value) => update({ lineSpacing: value as InteriorSettings['lineSpacing'] })}>
                      <SelectTrigger id="line-spacing" className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="wide">Wide ruled (11/32&quot;)</SelectItem>
                        <SelectItem value="college">College ruled (9/32&quot;)</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </div>
              <FieldSeparator />
              {toggle('titlePage', 'Title page', 'Open the book with the title and subtitle, then a blank page.', settings.titlePage, (v) => update({ titlePage: v }))}
              {toggle('largePrint', 'Large print', 'Bigger text and bolder lines for easier reading.', settings.largePrint, (v) => update({ largePrint: v }))}
              {!isJournal && (
                <>
                  {toggle('howToPlay', 'How to play pages', 'A rules page for each puzzle type, before the puzzles.', settings.howToPlay, (v) => update({ howToPlay: v }))}
                  {toggle('solutions', 'Solutions', 'Answers to every puzzle at the back of the book.', settings.solutions === 'back', (v) => update({ solutions: v ? 'back' : 'none' }))}
                </>
              )}
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Text</CardTitle>
            <CardDescription>Fonts and colors for titles, text and puzzle letters.</CardDescription>
          </CardHeader>
          <CardContent>
            <TypographyFields project={project} typography={settings.typography} onChange={updateTypography} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Page design</CardTitle>
            <CardDescription>A border, a background pattern or your own graphic.</CardDescription>
          </CardHeader>
          <CardContent>
            <PageDesignFields project={project} decor={settings.decor} image={image} onChange={updateDecor}
              onImage={(next) => {
                setImage(next);
                updateDecor({ imageId: next?.id ?? null });
              }} />
          </CardContent>
        </Card>
      </div>

      {/* Stays in view while scrolling through the settings */}
      <div className="flex flex-col gap-4 lg:sticky lg:top-4">
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>A right-hand page{project.paper === 'color' ? '' : ', in print greys'}.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="mx-auto w-full max-w-64">
              <PageDesignPreview project={project} decor={settings.decor} image={image}
                heading={{ fontFamily: cssFamily(settings.typography.headingFont), color: headingColor }} />
            </div>
            <TypographySample project={project} typography={settings.typography} />
          </CardContent>
        </Card>
        <Button onClick={save} disabled={saving || !dirty}>
          {saving && <Loader2Icon className="animate-spin" />}
          {dirty ? 'Save interior' : 'Saved'}
        </Button>
      </div>
    </div>
  );
}
