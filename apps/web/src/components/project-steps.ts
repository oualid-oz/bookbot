import type { ProjectSummary } from "@/components/project-options"

export interface ProjectProgress {
  puzzles: number
  interiorSaved: boolean
  coverSaved: boolean
  listingErrors: number
  listingWarnings: number
  interiorExported: boolean
  coverExported: boolean
}

export type StepStatus = "done" | "todo" | "warning" | "optional"

export interface ProjectStep {
  id: string
  title: string
  status: StepStatus
  /** Short state shown under the title, e.g. "12 added" or "2 to fix" */
  hint?: string
}

export const STEP_IDS = ["details", "puzzles", "interior", "cover", "listing", "export"] as const
export type StepId = (typeof STEP_IDS)[number]

/** The steps of making a book, with their status */
export function buildSteps(project: Pick<ProjectSummary, "type">, progress: ProjectProgress): ProjectStep[] {
  const puzzleBook = project.type === "puzzle_book"
  const exportedCount = Number(progress.interiorExported) + Number(progress.coverExported)
  return [
    { id: "details", title: "Details", status: "done" },
    {
      id: "puzzles",
      title: "Puzzles",
      status: progress.puzzles > 0 ? "done" : puzzleBook ? "todo" : "optional",
      hint: progress.puzzles > 0 ? `${progress.puzzles} added` : puzzleBook ? undefined : "Optional",
    },
    { id: "interior", title: "Interior", status: progress.interiorSaved ? "done" : "todo" },
    { id: "cover", title: "Cover", status: progress.coverSaved ? "done" : "todo" },
    {
      id: "listing",
      title: "Listing",
      status: progress.listingErrors > 0 ? "warning" : "done",
      hint: progress.listingErrors > 0 ? `${progress.listingErrors} to fix` : undefined,
    },
    {
      id: "export",
      title: "Export",
      status: exportedCount === 2 ? "done" : "todo",
      hint: exportedCount === 1 ? "1 of 2 files" : undefined,
    },
  ]
}

/** The first step that still needs work, or null when the book is finished */
export function nextStep(steps: ProjectStep[]): ProjectStep | null {
  return steps.find((s) => s.status === "todo" || s.status === "warning") ?? null
}

/** Share of the steps that count (optional ones don't) that are done */
export function completion(steps: ProjectStep[]): number {
  const counted = steps.filter((s) => s.status !== "optional")
  return Math.round((counted.filter((s) => s.status === "done").length / counted.length) * 100)
}
