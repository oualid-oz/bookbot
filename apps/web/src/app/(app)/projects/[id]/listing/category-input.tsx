'use client';

import { useId, useState } from 'react';
import { searchKdpCategories } from '@bookbot/core';
import { cn } from 'cn';
import { Input } from '@/components/ui/input';

/** A category field that suggests from the built-in list; any other text is kept as typed */
export function CategoryInput({ label, value, exclude, placeholder, onChange }: {
  label: string;
  value: string;
  /** Categories already chosen in the other fields */
  exclude: string[];
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const options = open ? searchKdpCategories(value, [...exclude, value]) : [];

  const choose = (option: string) => {
    onChange(option);
    setOpen(false);
    setHighlight(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      if (options.length) {
        const step = e.key === 'ArrowDown' ? 1 : -1;
        setHighlight((highlight + step + options.length) % options.length);
      }
    } else if (e.key === 'Enter' && options[highlight]) {
      e.preventDefault();
      choose(options[highlight]);
    }
  };

  return (
    <div className="relative">
      <Input
        role="combobox"
        aria-label={label}
        aria-expanded={options.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={options[highlight] ? `${listId}-${highlight}` : undefined}
        autoComplete="off"
        maxLength={200}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlight(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {options.length > 0 && (
        <ul id={listId} role="listbox" aria-label={`${label} suggestions`}
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border bg-popover p-1 text-sm text-popover-foreground shadow-md">
          {options.map((option, i) => (
            <li key={option} id={`${listId}-${i}`} role="option" aria-selected={i === highlight}
              className={cn('cursor-pointer rounded-md px-2 py-1.5', i === highlight ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50')}
              // Before the input's blur closes the list
              onMouseDown={(e) => {
                e.preventDefault();
                choose(option);
              }}>
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
