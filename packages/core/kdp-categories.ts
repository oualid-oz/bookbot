/**
 * Common Amazon book categories for KDP listings, weighted towards puzzle
 * books, journals and activity books. A starting list to search, not an
 * official one: Amazon changes its categories, so the final choice happens in
 * KDP's own category picker.
 */
const groups: Record<string, string[]> = {
  'Humor & Entertainment › Puzzles & Games': [
    'Word Search',
    'Crossword Puzzles',
    'Sudoku',
    'Logic & Brain Teasers',
    'Math Puzzles',
    'Mazes',
    'Trivia',
    'Word Games',
    'Card Games',
    'Board Games',
    'Quizzes',
  ],
  "Children's Books › Activities, Crafts & Games": [
    'Activity Books',
    'Coloring Books',
    'Games',
    'Puzzles',
    'Mazes',
    'Word Games',
    'Crafts & Hobbies',
    'Stickers',
  ],
  "Children's Books › Education & Reference": ['Math', 'Reading & Writing', 'Language Arts', 'Science Studies', 'Workbooks'],
  'Crafts, Hobbies & Home': [
    'Crafts & Hobbies › Coloring Books for Grown-Ups',
    'Crafts & Hobbies › Papercrafts, Stamping & Stenciling',
    'Crafts & Hobbies › Scrapbooking',
    'Gardening & Landscape Design',
    'Pets & Animal Care',
    'Home Improvement & Design',
    'Weddings',
  ],
  'Self-Help': [
    'Journal Writing',
    'Happiness',
    'Motivational',
    'Personal Transformation',
    'Stress Management',
    'Time Management',
    'Memory Improvement',
    'Creativity',
    'Spiritual',
  ],
  'Health, Fitness & Dieting': ['Exercise & Fitness', 'Diets & Weight Loss', 'Mental Health', 'Aging', 'Alternative Medicine'],
  'Religion & Spirituality': [
    'Christian Books & Bibles › Christian Living › Prayer',
    'Christian Books & Bibles › Bible Study & Reference',
    'Christian Books & Bibles › Christian Living › Devotionals',
    'Occult & Paranormal',
    'New Age & Spirituality',
  ],
  'Business & Money': ['Time Management', 'Personal Finance', 'Small Business & Entrepreneurship', 'Management & Leadership'],
  'Parenting & Relationships': ['Family Activities', 'Parenting', 'Relationships', 'Pregnancy & Childbirth'],
  'Cookbooks, Food & Wine': ['Baking', 'Quick & Easy', 'Regional & International', 'Special Diet', 'Reference'],
  'Travel': ['Travel Writing', 'Reference', 'United States', 'Europe'],
  'Sports & Outdoors': ['Hiking & Camping', 'Hunting & Fishing', 'Golf', 'Team Sports', 'Outdoor Recreation'],
  'Arts & Photography': ['Drawing', 'Painting', 'Graphic Design', 'Music'],
  'Education & Teaching': ['Teacher Resources', 'Schools & Teaching', 'Studying & Workbooks'],
  'Reference': ['Word Lists', 'Writing, Research & Publishing Guides', 'Dictionaries & Thesauruses', 'Calendars & Planners'],
  'Teen & Young Adult': ['Hobbies & Games', 'Personal Health', 'Literature & Fiction'],
  'Literature & Fiction': ['Poetry', 'Humor & Satire', 'Short Stories & Anthologies'],
  'Science Fiction & Fantasy': ['Fantasy', 'Science Fiction'],
  'Romance': ['Contemporary', 'Historical', 'Paranormal'],
  'Mystery, Thriller & Suspense': ['Mystery', 'Thrillers & Suspense'],
};

export const KDP_CATEGORIES: string[] = Object.entries(groups).flatMap(([group, items]) => items.map((item) => `Books › ${group} › ${item}`));

/**
 * Categories containing every word of the query, in any order. An empty query
 * returns the start of the list (puzzles and activity books first).
 */
export function searchKdpCategories(query: string, exclude: string[] = [], limit = 8): string[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const excluded = new Set(exclude.map((c) => c.toLowerCase()));
  return KDP_CATEGORIES.filter((category) => {
    const lower = category.toLowerCase();
    return !excluded.has(lower) && words.every((word) => lower.includes(word));
  }).slice(0, limit);
}
