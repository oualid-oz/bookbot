'use client';

import { useState } from 'react';
import { AlertCircleIcon, BookmarkIcon, Loader2Icon, SearchIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MARKETPLACES } from '@bookbot/shared';


interface KeywordResult {
  keyword: string;
  marketplace: string;
  volume: number;
  competition: number | string;
  cached: boolean;
}

export default function ResearchPage() {
  const [keyword, setKeyword] = useState('');
  const [marketplace, setMarketplace] = useState('US');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<KeywordResult | null>(null);
  const [error, setError] = useState('');

  const handleKeywordSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/research/keyword', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The server uses the signed-in user's default organization
        body: JSON.stringify({ keyword, marketplace }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to fetch keyword data');
        return;
      }

      setResult(data);
    } catch {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Keyword Research</h1>
        <p className="text-muted-foreground">Check search volume and competition for a KDP keyword.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Keyword lookup</CardTitle>
          <CardDescription>Results are cached for 7 days per marketplace.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form onSubmit={handleKeywordSearch} className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Enter keyword..."
              aria-label="Keyword"
              className="flex-1"
            />
            <Select value={marketplace} onValueChange={setMarketplace}>
              <SelectTrigger aria-label="Marketplace" className="sm:w-24 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MARKETPLACES.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" disabled={loading || !keyword}>
              {loading ? <Loader2Icon className="animate-spin" /> : <SearchIcon />}
              {loading ? 'Searching...' : 'Search'}
            </Button>
          </form>

          {error && (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Results for &ldquo;{result.keyword}&rdquo;</CardTitle>
            <CardDescription>Marketplace: {result.marketplace}</CardDescription>
            {result.cached && (
              <CardAction>
                <Badge variant="secondary">Cached</Badge>
              </CardAction>
            )}
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">Search volume</div>
              <div className="text-2xl font-semibold tabular-nums">{result.volume.toLocaleString()}</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">Competition</div>
              <div className="text-2xl font-semibold tabular-nums">
                {(Number(result.competition) * 100).toFixed(1)}%
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Saved niches</CardTitle>
          <CardDescription>Niches you save will appear here.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            <BookmarkIcon className="size-5" />
            Use the Chrome extension to analyze Amazon results.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
