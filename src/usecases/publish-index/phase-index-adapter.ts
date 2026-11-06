import type { PublishIndexStore } from "./publish-index-store.js";
import type {
  PhaseType,
  PublishIndex,
} from "./publish-index-types.js";

/**
 * Adaptador temporal (issue 23): sustituye a GitHubPublicationService.getPhaseIndex()
 * reconstruyendo el PublishIndex a partir de PublishIndexStore.
 *
 * Equivalencia funcional con el monolito:
 * - índice inexistente → { phase, packages: [] } (igual que el original)
 * - índice válido      → { phase, packages } (igual que el original)
 * - índice corrupto    → PublishIndexError INDEX_INVALID (el original lanza
 *   ApiError 502 GITHUB_INDEX_INVALID; el mapeo a HTTP se hará en la capa API)
 */
export async function phaseIndexFromStore(
  store: PublishIndexStore,
  phase: PhaseType
): Promise<PublishIndex> {
  const packages = await store.getPublishedPackages(phase);
  return { phase, packages: [...packages] };
}
