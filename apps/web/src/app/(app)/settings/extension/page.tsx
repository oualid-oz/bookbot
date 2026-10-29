'use client';

import { useEffect, useState } from 'react';
import { CheckIcon, CopyIcon, KeyRoundIcon, Loader2Icon, PlusIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api-client';

interface Token {
  id: string;
  name: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export default function ExtensionSettingsPage() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [name, setName] = useState('Chrome extension');
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = () =>
    apiFetch<{ tokens: Token[] }>('/api/extension/tokens')
      .then((data) => setTokens(data.tokens))
      .catch((err) => toast.error(err.message));

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const { token } = await apiFetch<{ token: string }>('/api/extension/tokens', { method: 'POST', body: { name } });
      setNewToken(token);
      setCopied(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create token');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (token: Token) => {
    try {
      await apiFetch(`/api/extension/tokens/${token.id}`, { method: 'DELETE' });
      setTokens((list) => list.filter((t) => t.id !== token.id));
      toast.success(`Revoked “${token.name}”`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not revoke token');
    }
  };

  const copy = async () => {
    if (!newToken) return;
    await navigator.clipboard.writeText(newToken);
    setCopied(true);
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Chrome extension</h1>
        <p className="text-muted-foreground">Connect the Bookbot extension to see sales estimates on Amazon.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New token</CardTitle>
          <CardDescription>Create a token, then paste it into the extension&apos;s popup.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form onSubmit={handleCreate}>
            <FieldGroup>
              <div className="flex items-end gap-2">
                <Field className="flex-1">
                  <FieldLabel htmlFor="token-name">Name</FieldLabel>
                  <Input id="token-name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Button type="submit" disabled={creating || !name.trim()}>
                  {creating ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
                  Create token
                </Button>
              </div>
            </FieldGroup>
          </form>

          {newToken && (
            <Alert>
              <KeyRoundIcon />
              <AlertTitle>Copy your token now</AlertTitle>
              <AlertDescription className="flex flex-col gap-2">
                You won&apos;t be able to see it again.
                <div className="flex gap-2">
                  <Input readOnly value={newToken} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
                  <Button type="button" variant="outline" onClick={copy}>
                    {copied ? <CheckIcon /> : <CopyIcon />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active tokens</CardTitle>
          <CardDescription>Revoke a token to disconnect that browser immediately.</CardDescription>
        </CardHeader>
        <CardContent>
          {tokens.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tokens yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last used</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokens.map((token) => (
                  <TableRow key={token.id}>
                    <TableCell className="font-medium">{token.name}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(token.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {token.lastUsedAt ? new Date(token.lastUsedAt).toLocaleString() : 'Never'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleRevoke(token)}>Revoke</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
