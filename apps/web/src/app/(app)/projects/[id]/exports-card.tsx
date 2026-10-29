'use client';

import { useCallback, useEffect, useState } from 'react';
import { DownloadIcon, FileTextIcon, ImageIcon, Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api-client';

interface ExportRow {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  spec: { kind?: 'interior' | 'cover' };
  errorMessage: string | null;
  createdAt: string;
  downloadUrl: string | null;
}

const STATUS_VARIANT = {
  pending: 'outline',
  processing: 'secondary',
  completed: 'default',
  failed: 'destructive',
} as const;

export function ExportsCard({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<ExportRow[]>([]);
  const [starting, setStarting] = useState<string | null>(null);

  const load = useCallback(
    () =>
      apiFetch<{ exports: ExportRow[] }>(`/api/projects/${projectId}/exports`)
        .then((data) => setRows(data.exports))
        .catch(() => {}),
    [projectId]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Poll while anything is still being rendered
  const active = rows.some((r) => r.status === 'pending' || r.status === 'processing');
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(load, 2000);
    return () => clearInterval(timer);
  }, [active, load]);

  const startExport = async (kind: 'interior' | 'cover') => {
    setStarting(kind);
    try {
      await apiFetch('/api/export', { method: 'POST', body: { projectId, spec: { kind } } });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not start export');
    } finally {
      setStarting(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Exports</CardTitle>
        <CardDescription>Print-ready PDFs sized for KDP.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => startExport('interior')} disabled={starting !== null}>
            {starting === 'interior' ? <Loader2Icon className="animate-spin" /> : <FileTextIcon />}
            Export interior
          </Button>
          <Button variant="outline" onClick={() => startExport('cover')} disabled={starting !== null}>
            {starting === 'cover' ? <Loader2Icon className="animate-spin" /> : <ImageIcon />}
            Export cover
          </Button>
        </div>

        {rows.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Download</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="capitalize">{row.spec?.kind ?? 'interior'}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[row.status]} title={row.errorMessage ?? undefined}>
                      {(row.status === 'pending' || row.status === 'processing') && <Loader2Icon className="animate-spin" />}
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{new Date(row.createdAt).toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    {row.downloadUrl && (
                      <Button variant="ghost" size="icon-sm" asChild>
                        <a href={row.downloadUrl} aria-label="Download PDF">
                          <DownloadIcon />
                        </a>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
