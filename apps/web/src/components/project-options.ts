import { TRIM_SIZES } from "@bookbot/core"

export const PROJECT_TYPE_LABELS = {
  book: "Book",
  puzzle_book: "Puzzle book",
  journal: "Journal",
} as const

export const PAPER_LABELS = {
  white: "White",
  cream: "Cream",
  color: "Color",
} as const

export const TRIM_OPTIONS = Object.entries(TRIM_SIZES).map(([value, trim]) => ({ value, label: trim.name }))

export interface ProjectSummary {
  id: string
  title: string
  subtitle: string | null
  type: keyof typeof PROJECT_TYPE_LABELS
  trimSize: string
  pageCount: number
  paper: keyof typeof PAPER_LABELS
  updatedAt: string
}
