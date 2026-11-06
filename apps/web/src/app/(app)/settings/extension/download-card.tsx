'use client';

import { useEffect, useState } from 'react';
import { DownloadIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface ExtensionBuild {
  version: string;
  apiUrl: string;
}

const STEPS = [
  <>Download the file below and unzip it into a folder you&apos;ll keep. Chrome loads the extension from there, so don&apos;t delete it.</>,
  <>In Chrome, open <code className="rounded bg-muted px-1 py-0.5 text-xs">chrome://extensions</code> and turn on <strong>Developer mode</strong> (top right).</>,
  <>Click <strong>Load unpacked</strong> and choose the folder you unzipped.</>,
  <>Create a token below, then paste it into the extension&apos;s popup.</>,
];

/** The extension zip, built with each deployment; hidden when this deployment has none */
export function DownloadCard() {
  const [build, setBuild] = useState<ExtensionBuild | null | undefined>(undefined);

  useEffect(() => {
    fetch('/downloads/extension.json')
      .then((res) => (res.ok ? res.json() : null))
      .then(setBuild)
      .catch(() => setBuild(null));
  }, []);

  if (build === undefined) return <Skeleton className="h-64 rounded-xl" />;
  if (build === null) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Install the extension</CardTitle>
        <CardDescription>Works in Chrome, and in Chromium browsers such as Edge and Brave.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ol className="flex flex-col gap-3">
          {STEPS.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium">{i + 1}</span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild>
            {/* The version in the URL makes browsers fetch a new build instead of a cached one */}
            <a href={`/downloads/bookbot-extension.zip?v=${build.version}`} download={`bookbot-extension-${build.version}.zip`}>
              <DownloadIcon />
              Download extension
            </a>
          </Button>
          <span className="text-sm text-muted-foreground">Version {build.version}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          To update: download again, replace the files in the same folder, then click the reload icon on the extension in{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">chrome://extensions</code>. Your token stays connected.
        </p>
      </CardContent>
    </Card>
  );
}
