'use client';

import { useState } from 'react';

export default function ResearchPage() {
  const [keyword, setKeyword] = useState('');
  const [marketplace, setMarketplace] = useState('US');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleKeywordSearch = async () => {
    if (!keyword) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/research/keyword', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword,
          marketplace,
          orgId: 'demo-org-id',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to fetch keyword data');
        return;
      }

      setResult(data);
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Keyword Research</h1>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex gap-4 mb-4">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Enter keyword..."
              className="flex-1 px-4 py-2 border rounded-lg"
              onKeyPress={(e) => e.key === 'Enter' && handleKeywordSearch()}
            />
            <select
              value={marketplace}
              onChange={(e) => setMarketplace(e.target.value)}
              className="px-4 py-2 border rounded-lg"
            >
              <option value="US">US</option>
              <option value="UK">UK</option>
              <option value="DE">DE</option>
              <option value="FR">FR</option>
              <option value="ES">ES</option>
              <option value="IT">IT</option>
              <option value="JP">JP</option>
            </select>
            <button
              onClick={handleKeywordSearch}
              disabled={loading}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          {result && (
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-2">Results for "{result.keyword}"</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-600">Search Volume:</span>
                  <span className="ml-2 font-medium">{result.volume}</span>
                </div>
                <div>
                  <span className="text-gray-600">Competition:</span>
                  <span className="ml-2 font-medium">{(result.competition * 100).toFixed(1)}%</span>
                </div>
              </div>
              {result.cached && (
                <div className="mt-2 text-sm text-gray-500">
                  (Cached from {new Date().toLocaleDateString()})
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Saved Niches</h2>
          <p className="text-gray-600">
            Saved niches will appear here. Use the Chrome extension to analyze Amazon results.
          </p>
        </div>
      </div>
    </div>
  );
}
