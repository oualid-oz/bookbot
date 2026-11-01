'use client';

import { useEffect, useState } from 'react';
import { Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { PAGE_TEMPLATES, type InteriorSettings, type PageTemplate } from '@bookbot/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { apiFetch } from '@/lib/api-client';
import type { ProjectSummary } from '@/components/project-options';

const TEMPLATE_NAMES: Record<PageTemplate, string> = {
  blank: 'Blank',
  lined: 'Lined',
  dotted: 'Dot grid',
  grid: 'Graph paper',
  gratitude: 'Gratitude journal',
  daily_planner: 'Daily planner',
};

export function InteriorCard({ project }: { project: ProjectSummary }) {
  const [settings, setSettings] = useState<InteriorSettings | null>(null);
  const [saved, setSaved] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<{ settings: InteriorSettings }>(`/api/projects/${project.id}/interior`)
      .then(({ settings }) => {
        setSettings(settings);
        setSaved(JSON.stringify(settings));
      })
      .catch((err) => toast.error(err.message));
  }, [project.id]);

  if (!settings) return <Skeleton className="h-64 rounded-xl" />;

  const update = (changes: Partial<InteriorSettings>) => setSettings({ ...settings, ...changes });
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Interior</CardTitle>
        <CardDescription>How the inside pages are laid out when you export.</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="page-template">{isJournal ? 'Page style' : 'Extra pages'}</FieldLabel>
            <Select value={template} onValueChange={(value) => update({ pageTemplate: value as PageTemplate })}>
              <SelectTrigger id="page-template" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAGE_TEMPLATES.map((t) => <SelectItem key={t} value={t}>{TEMPLATE_NAMES[t]}</SelectItem>)}
              </SelectContent>
            </Select>
            <FieldDescription>
              {isJournal ? 'Used for every page of the journal.' : `Fills the book up to ${project.pageCount} pages after the content.`}
            </FieldDescription>
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

          {toggle('largePrint', 'Large print', 'Bigger text and bolder lines for easier reading.', settings.largePrint, (v) => update({ largePrint: v }))}
          {!isJournal && (
            <>
              {toggle('howToPlay', 'How to play pages', 'A rules page for each puzzle type, before the puzzles.', settings.howToPlay, (v) => update({ howToPlay: v }))}
              {toggle('solutions', 'Solutions', 'Answers to every puzzle at the back of the book.', settings.solutions === 'back', (v) => update({ solutions: v ? 'back' : 'none' }))}
            </>
          )}

          <Field orientation="horizontal">
            <Button onClick={save} disabled={saving || JSON.stringify(settings) === saved}>
              {saving && <Loader2Icon className="animate-spin" />}
              Save interior
            </Button>
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
