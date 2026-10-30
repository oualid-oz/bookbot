import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { assets, db, exports, listings, projectDocs, projects, puzzleSets } from '@bookbot/db';
import { EXPORT_QUEUE, coverDesignSchema, exportSpecSchema, type ExportJobData } from '@bookbot/shared';
import { getStorage } from '@bookbot/storage';
import { renderCover, type CoverImageFile } from '../render/cover';
import { renderInterior, type WordSearchContent } from '../render/interior';

// BullMQ workers use blocking commands, which require maxRetriesPerRequest: null
export const connection = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

export async function processExport(job: Job<ExportJobData>) {
  const { exportId } = job.data;

  const [row] = await db
    .select({ export: exports, project: projects })
    .from(exports)
    .innerJoin(projects, eq(exports.projectId, projects.id))
    .where(eq(exports.id, exportId))
    .limit(1);

  if (!row) {
    // Deleted before we got to it; nothing to retry
    console.warn(`Export ${exportId} not found, skipping`);
    return;
  }
  // Completed, or marked failed by the API (e.g. a queue timeout whose job
  // arrived late): never re-render those
  if (row.export.status !== 'pending' && row.export.status !== 'processing') {
    console.warn(`Export ${exportId} is ${row.export.status}, skipping`);
    return;
  }

  const { project } = row;
  console.log(`Processing export ${exportId} for project ${project.id}`);

  await db.update(exports).set({ status: 'processing', updatedAt: new Date() }).where(eq(exports.id, exportId));

  const spec = exportSpecSchema.parse(row.export.spec ?? {});
  const [listing] = await db.select().from(listings).where(eq(listings.projectId, project.id)).limit(1);
  const title = listing?.title || 'Untitled book';

  let pdf: Uint8Array;
  if (spec.kind === 'cover') {
    // The saved editor design, or the default design with the book's title
    const [doc] = await db
      .select({ jsonState: projectDocs.jsonState })
      .from(projectDocs)
      .where(and(eq(projectDocs.projectId, project.id), eq(projectDocs.kind, 'cover')))
      .limit(1);
    const saved = coverDesignSchema.safeParse(doc?.jsonState);
    const design = saved.success
      ? saved.data
      : coverDesignSchema.parse({ title, subtitle: listing?.subtitle ?? '' });

    // Only finished uploads from the project's own organization
    const ids = [design.frontImageId, design.backImageId].filter((id): id is string => !!id);
    const imageRows = ids.length
      ? await db
          .select()
          .from(assets)
          .where(and(inArray(assets.id, ids), eq(assets.orgId, project.orgId), eq(assets.status, 'ready')))
      : [];
    const imageFiles: Record<string, CoverImageFile> = {};
    for (const row of imageRows) {
      const bytes = await getStorage().get(row.r2Key);
      if (bytes && row.mimeType) imageFiles[row.id] = { bytes, mimeType: row.mimeType };
    }
    const imageInfo = (id: string | null) => {
      const row = imageRows.find((r) => r.id === id);
      return row && imageFiles[row.id] && row.width && row.height ? { assetId: row.id, width: row.width, height: row.height } : null;
    };

    pdf = await renderCover(
      {
        ...design,
        trimSize: project.trimSize,
        pageCount: project.pageCount,
        paper: project.paper,
        frontImage: imageInfo(design.frontImageId),
        backImage: imageInfo(design.backImageId),
      },
      imageFiles
    );
  } else {
    const sets = await db
      .select()
      .from(puzzleSets)
      .where(eq(puzzleSets.projectId, project.id))
      .orderBy(asc(puzzleSets.createdAt));

    pdf = await renderInterior({
      title,
      subtitle: listing?.subtitle,
      projectType: project.type,
      trimSize: project.trimSize,
      pageCount: project.pageCount,
      puzzles: sets.filter((s) => s.type === 'word_search').map((s) => s.content as WordSearchContent),
    });
  }

  const key = `exports/${project.orgId}/${exportId}.pdf`;
  await getStorage().put(key, pdf, 'application/pdf');

  await db
    .update(exports)
    .set({ status: 'completed', r2Key: key, errorMessage: null, completedAt: new Date(), updatedAt: new Date() })
    .where(eq(exports.id, exportId));

  console.log(`Export ${exportId} completed (${spec.kind}, ${(pdf.length / 1024).toFixed(1)} KB)`);
}

export const exportWorker = new Worker<ExportJobData>(EXPORT_QUEUE, processExport, {
  connection,
  concurrency: 2,
});

// Only mark the export failed once BullMQ has no retries left
exportWorker.on('failed', async (job, error) => {
  if (!job) return;
  const attempts = job.opts.attempts ?? 1;
  console.error(`Export ${job.data.exportId} attempt ${job.attemptsMade}/${attempts} failed:`, error.message);
  if (job.attemptsMade >= attempts) {
    await db
      .update(exports)
      .set({ status: 'failed', errorMessage: error.message.slice(0, 1000), updatedAt: new Date() })
      .where(eq(exports.id, job.data.exportId));
  }
});
