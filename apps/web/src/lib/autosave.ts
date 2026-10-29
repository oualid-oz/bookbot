import { and, eq } from 'drizzle-orm';
import { db } from '@bookbot/db';
import { projectDocs } from '@bookbot/db/schema';

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Save project document state
 */
export async function saveProjectDoc(
  projectId: string,
  kind: 'cover' | 'interior',
  jsonState: any
) {
  // Check if doc exists
  const existing = await db
    .select()
    .from(projectDocs)
    .where(and(eq(projectDocs.projectId, projectId), eq(projectDocs.kind, kind)))
    .limit(1);

  if (existing[0]) {
    // Update with version increment
    await db
      .update(projectDocs)
      .set({
        jsonState,
        version: existing[0].version + 1,
        updatedAt: new Date(),
      })
      .where(eq(projectDocs.id, existing[0].id));
  } else {
    // Create new
    await db.insert(projectDocs).values({
      projectId,
      kind,
      jsonState,
      version: 1,
    });
  }
}

/**
 * Get project document state
 */
export async function getProjectDoc(
  projectId: string,
  kind: 'cover' | 'interior'
) {
  const doc = await db
    .select()
    .from(projectDocs)
    .where(and(eq(projectDocs.projectId, projectId), eq(projectDocs.kind, kind)))
    .limit(1);

  return doc[0] || null;
}

/**
 * Create debounced autosave function
 */
export function createAutosave(
  projectId: string,
  kind: 'cover' | 'interior',
  delay: number = 2000 // 2 seconds default
) {
  return debounce((jsonState: any) => {
    saveProjectDoc(projectId, kind, jsonState);
  }, delay);
}
