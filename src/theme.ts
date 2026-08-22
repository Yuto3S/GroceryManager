// Simple shared design tokens so the app looks consistent.
export const colors = {
  bg: "#F7F8FA",
  card: "#FFFFFF",
  text: "#1A1D21",
  subtle: "#6B7280",
  border: "#E5E7EB",
  primary: "#2E7D46", // grocery green
  primaryText: "#FFFFFF",
  danger: "#DC2626",
};

/** The five official Nutri-Score grades, best to worst. */
export type NutriScore = "A" | "B" | "C" | "D" | "E";

// Official Nutri-Score colours (A best → E worst).
export const nutriColors = {
  A: "#1E8F4E",
  B: "#85BB2F",
  C: "#F9C000",
  D: "#EF8200",
  E: "#E63E11",
} satisfies Record<NutriScore, string>;

/**
 * Colour for a Nutri-Score grade, falling back for anything unrecognized.
 *
 * Grades reach us from Open Food Facts, so the value is a plain string that
 * might not be a grade at all. The widened lookup keeps that honest — no cast
 * pretending an arbitrary string is a `NutriScore`.
 */
export function nutriColorFor(grade: string | null | undefined): string {
  const byGrade: Record<string, string | undefined> = nutriColors;
  return (grade ? byGrade[grade] : undefined) ?? colors.subtle;
}
