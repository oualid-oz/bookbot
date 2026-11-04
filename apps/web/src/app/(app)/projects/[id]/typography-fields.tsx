'use client';

import { printColor } from '@bookbot/core';
import { BODY_FONT_IDS, FONTS, FONT_IDS, type FontId, type FontInfo } from '@bookbot/fonts';
import type { InteriorSettings } from '@bookbot/shared';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ProjectSummary } from '@/components/project-options';

type Typography = InteriorSettings['typography'];

/** Close stand-ins for the PDF's built-in fonts */
const STANDARD_CSS: Record<NonNullable<FontInfo['standard']>, string> = {
  Helvetica: 'Helvetica, Arial, sans-serif',
  TimesRoman: '"Times New Roman", Times, serif',
  Courier: '"Courier New", Courier, monospace',
};

/** CSS font-family for a font: the same TTF the PDF embeds, loaded from /fonts */
export function cssFamily(id: FontId) {
  const info = FONTS[id] as FontInfo;
  return info.standard ? STANDARD_CSS[info.standard] : `"bookbot-${id}", sans-serif`;
}

/** @font-face rules for every font with a file */
export function FontFaces() {
  const rules = (Object.entries(FONTS) as [FontId, FontInfo][])
    .filter(([, info]) => info.regular)
    .flatMap(([id, info]) => [
      `@font-face{font-family:"bookbot-${id}";src:url(/fonts/${info.regular}) format("truetype");font-weight:400;font-display:swap}`,
      `@font-face{font-family:"bookbot-${id}";src:url(/fonts/${info.bold ?? info.regular}) format("truetype");font-weight:700;font-display:swap}`,
    ]);
  return <style>{rules.join('')}</style>;
}

function FontSelect({ id, label, value, options, onChange }: {
  id: string;
  label: string;
  value: FontId;
  options: FontId[];
  onChange: (font: FontId) => void;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select value={value} onValueChange={(v) => onChange(v as FontId)}>
        <SelectTrigger id={id} className="w-full" style={{ fontFamily: cssFamily(value) }}><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((font) => (
            <SelectItem key={font} value={font} style={{ fontFamily: cssFamily(font) }}>{FONTS[font].name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function ColorField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (color: string) => void }) {
  return (
    <Field className="w-16">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} type="color" className="h-9 p-1" value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

export function TypographyFields({ project, typography, onChange }: {
  project: ProjectSummary;
  typography: Typography;
  onChange: (changes: Partial<Typography>) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <FontSelect id="heading-font" label="Title font" value={typography.headingFont} options={FONT_IDS}
              onChange={(headingFont) => onChange({ headingFont })} />
          </div>
          <ColorField id="heading-color" label="Color" value={typography.headingColor} onChange={(headingColor) => onChange({ headingColor })} />
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <FontSelect id="body-font" label="Text font" value={typography.bodyFont} options={BODY_FONT_IDS}
              onChange={(bodyFont) => onChange({ bodyFont })} />
          </div>
          <ColorField id="text-color" label="Color" value={typography.textColor} onChange={(textColor) => onChange({ textColor })} />
        </div>
        {project.type !== 'journal' && (
          <FontSelect id="puzzle-font" label="Puzzle letters" value={typography.puzzleFont} options={BODY_FONT_IDS}
            onChange={(puzzleFont) => onChange({ puzzleFont })} />
        )}
      </div>
      <FieldDescription>Grid lines stay black so puzzles print crisply.</FieldDescription>
    </div>
  );
}

/** The chosen fonts and print colors on sample text */
export function TypographySample({ project, typography }: { project: ProjectSummary; typography: Typography }) {
  const colorPaper = project.paper === 'color';
  const textColor = printColor(typography.textColor, colorPaper);
  return (
    <div className="flex flex-col gap-2 rounded-md border bg-white p-4 text-black" aria-label="Text preview">
      <p className="text-center text-lg font-bold" style={{ fontFamily: cssFamily(typography.headingFont), color: printColor(typography.headingColor, colorPaper) }}>
        Puzzle 1 · Ocean Life
      </p>
      {project.type !== 'journal' && (
        <p className="text-center font-bold tracking-[0.3em]" style={{ fontFamily: cssFamily(typography.puzzleFont), color: textColor }}>
          WHALESQRCORAL
        </p>
      )}
      <p className="text-sm" style={{ fontFamily: cssFamily(typography.bodyFont), color: textColor }}>
        Find every word from the list hidden in the grid. Words run across, down or diagonally.
      </p>
    </div>
  );
}
