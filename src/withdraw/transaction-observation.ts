export type SubmissionObservation = "included" | "aborted" | "not_observed";

/**
 * Classifies a transaction returned by any supported transport. A missing
 * transaction is only used by Toncenter polling; direct JRPC senders throw
 * when their client cannot observe a transaction before its timeout.
 */
export function submissionObservation(transaction: unknown): SubmissionObservation {
  if (!transaction || typeof transaction !== "object") return "not_observed";
  return (transaction as { aborted?: unknown }).aborted === true ? "aborted" : "included";
}
