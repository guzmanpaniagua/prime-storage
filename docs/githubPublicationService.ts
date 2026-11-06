import { createHash } from 'node:crypto';
import ApiError from '../models/ApiError.js';
import type { PhaseAuditEntry, PhaseType, ProjectPhase, PublishIndex, PublishIndexEntry } from '../models/packageTypes.js';
import { PHASE_SEQUENCE, phaseFolder } from '../models/packageTypes.js';
import type { CampaignCheckpointPointer, CampaignCheckpointSnapshot, GitHubCheckpointFile } from '../models/checkpointTypes.js';
import { WHEEL_SIZES } from '../config/primorials.js';
import { CampaignCheckpointError, GithubArtifactStorage, GithubCampaignCheckpointStore, GithubProjectStateStore, GithubPublishIndexStore, ProjectStateError, PublishIndexError, phaseIndexFromStore, publishedPackageFromStore } from 'prime-storage';
import type { PublishPackageInput } from 'prime-storage';

type GitHubOptions = {
  owner: string | null;
  repository: string | null;
  branch: string;
  token: string | null;
  apiBaseUrl?: string | null;
  fetchImpl?: typeof fetch;
  publishIndexStore?: GithubPublishIndexStore;
};

type GitHubFile = { path: string; base64: string };

const CAMPAIGN_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,100}$/;

function campaignRoot(campaignId: string): string {
  if (!CAMPAIGN_ID_PATTERN.test(campaignId)) throw new ApiError(400, 'INVALID_CAMPAIGN_ID', 'campaignId tiene un formato no permitido.');
  return `campaigns/${campaignId}`;
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isPublishIndex(value: unknown, phase: PhaseType): value is PublishIndex {
  if (!isRecord(value) || Object.keys(value).some((key) => !['phase', 'packages'].includes(key))
    || value.phase !== phase || !Array.isArray(value.packages)) return false;
  let previousPackageId = 0;
  return value.packages.every((entry) => {
    if (!isRecord(entry) || Object.keys(entry).some((key) => ![
      'packageId', 'filename', 'sha256', 'sizeBytes', 'firstLogicalBlock', 'lastLogicalBlock',
      'blockSize', 'blockCount', 'generatorVersion', 'wheelVersion', 'publishedAt', 'products',
    ].includes(key))) return false;
    const expectedFilename = `${prefixForPhase(phase)}-pack-${String(entry.packageId).padStart(6, '0')}.zip`;
    const valid = Number.isSafeInteger(entry.packageId)
      && (phase === 'PRODUCTS' ? entry.packageId === previousPackageId + 1 : (entry.packageId as number) > previousPackageId)
      && entry.filename === expectedFilename
      && typeof entry.sha256 === 'string' && /^[a-f0-9]{64}$/.test(entry.sha256)
      && Number.isSafeInteger(entry.sizeBytes) && (entry.sizeBytes as number) > 0
      && Number.isSafeInteger(entry.firstLogicalBlock) && (entry.firstLogicalBlock as number) >= 0
      && Number.isSafeInteger(entry.lastLogicalBlock) && (entry.lastLogicalBlock as number) >= (entry.firstLogicalBlock as number)
      && Number.isSafeInteger(entry.blockSize) && (entry.blockSize as number) > 0
      && Number.isSafeInteger(entry.blockCount) && (entry.blockCount as number) > 0
      && (entry.lastLogicalBlock as number) - (entry.firstLogicalBlock as number) + 1 === entry.blockCount
      && typeof entry.generatorVersion === 'string' && !!entry.generatorVersion.trim() && entry.generatorVersion.length <= 64
      && typeof entry.wheelVersion === 'string' && Object.hasOwn(WHEEL_SIZES, entry.wheelVersion)
      && typeof entry.publishedAt === 'string' && Number.isFinite(Date.parse(entry.publishedAt));
    const productsValid = phase === 'PRODUCTS'
      ? isRecord(entry.products)
        && entry.products.strategyVersion === 'products-package-v1'
        && entry.products.taskContractVersion === 'prime-product-task-v1'
        && entry.products.validatorVersion === 'prime-product-validator-v1'
        && entry.products.sourcePackageId === entry.packageId
        && typeof entry.products.sourceJobId === 'string' && !!entry.products.sourceJobId.trim()
      : entry.products === undefined;
    const validEntry = valid && productsValid;
    if (validEntry) previousPackageId = entry.packageId as number;
    return validEntry;
  });
}

function sameProductsPublication(existing: PublishIndexEntry, incoming: PublishIndexEntry): boolean {
  return existing.packageId === incoming.packageId
    && existing.filename === incoming.filename
    && existing.sha256 === incoming.sha256
    && existing.sizeBytes === incoming.sizeBytes
    && existing.firstLogicalBlock === incoming.firstLogicalBlock
    && existing.lastLogicalBlock === incoming.lastLogicalBlock
    && existing.blockSize === incoming.blockSize
    && existing.blockCount === incoming.blockCount
    && existing.generatorVersion === incoming.generatorVersion
    && existing.wheelVersion === incoming.wheelVersion
    && existing.products?.strategyVersion === incoming.products?.strategyVersion
    && existing.products?.taskContractVersion === incoming.products?.taskContractVersion
    && existing.products?.validatorVersion === incoming.products?.validatorVersion
    && existing.products?.sourcePackageId === incoming.products?.sourcePackageId
    && existing.products?.sourceJobId === incoming.products?.sourceJobId;
}

function prefixForPhase(phase: PhaseType): string {
  switch (phase) {
    case 'PRIMES': return 'primes';
    case 'PRODUCTS': return 'products';
    case 'ANCHORS': return 'anchor';
    case 'ANCHOR_SIEVE': return 'anchor-sieve';
    case 'FACTORS': return 'factors';
    case 'SMALL_CERTIFICATES': return 'small-certificates';
    case 'SUCCESSIVE_SIEVES': return 'successive-sieves';
    case 'FINAL_CERTIFICATION': return 'final-certificates';
  }
}

export class GitHubPublicationService {
  private readonly fetchImpl: typeof fetch;
  private readonly publishIndexStore: GithubPublishIndexStore | null;
  private readonly projectStateStore: GithubProjectStateStore | null;
  private readonly checkpointStore: GithubCampaignCheckpointStore | null;

  constructor(private readonly options: GitHubOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.publishIndexStore = options.publishIndexStore ?? (options.owner && options.repository && options.token
      ? new GithubPublishIndexStore(
          new GithubArtifactStorage(
            { owner: options.owner, repository: options.repository, branch: options.branch, token: options.token },
            this.fetchImpl
          )
        )
      : null);
    this.projectStateStore = options.owner && options.repository && options.token
      ? new GithubProjectStateStore(
          new GithubArtifactStorage(
            { owner: options.owner, repository: options.repository, branch: options.branch, token: options.token },
            this.fetchImpl
          )
        )
      : null;
    this.checkpointStore = options.owner && options.repository && options.token
      ? new GithubCampaignCheckpointStore(
          new GithubArtifactStorage(
            { owner: options.owner, repository: options.repository, branch: options.branch, token: options.token },
            this.fetchImpl
          )
        )
      : null;
    if (options.apiBaseUrl) {
      let url: URL;
      try { url = new URL(options.apiBaseUrl); } catch { throw new TypeError('apiBaseUrl debe ser una URL válida.'); }
      if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password) {
        throw new TypeError('apiBaseUrl personalizado solo puede usar un host loopback sin credenciales.');
      }
    }
  }

  isConfigured(): boolean {
    return Boolean(this.options.owner && this.options.repository && this.options.branch && this.options.token);
  }

  async verifyTargetBranch(): Promise<void> {
    const response = await this.request(`/git/ref/heads/${encodeURIComponent(this.options.branch)}`, { method: 'GET' });
    if (!response.ok) throw await this.apiError(response, 'No se encontró la rama configurada de GitHub.');
  }

  filename(phase: PhaseType, packageId: number): string {
    return `${prefixForPhase(phase)}-pack-${String(packageId).padStart(6, '0')}.zip`;
  }

  async getPhaseIndex(phase: PhaseType): Promise<PublishIndex> {
    if (!this.publishIndexStore) return { phase, packages: [] };
    try {
      return await phaseIndexFromStore(this.publishIndexStore, phase);
    } catch (error) {
      if (error instanceof PublishIndexError && error.code === 'INDEX_INVALID') {
        throw new ApiError(502, 'GITHUB_INDEX_INVALID', 'El índice de fase tiene una estructura inválida.');
      }
      throw error;
    }
  }

  async getPublishedPackageArchive(phase: PhaseType, packageId: number): Promise<{ entry: PublishIndexEntry; bytes: Uint8Array }> {
    if (!this.publishIndexStore) {
      throw new ApiError(502, 'GITHUB_PUBLISHED_ARCHIVE_MISSING', 'No hay store de publicación configurado.');
    }
    try {
      const { entry, bytes } = await publishedPackageFromStore(this.publishIndexStore, phase, packageId);
      return { entry, bytes };
    } catch (error) {
      if (error instanceof PublishIndexError) {
        if (error.code === 'INVALID_PACKAGE_ID') {
          throw new ApiError(400, 'INVALID_PACKAGE_ID', 'packageId debe ser un entero positivo.');
        }
        if (error.code === 'PACKAGE_NOT_FOUND') {
          throw new ApiError(404, 'PACKAGE_NOT_FOUND', 'No se encontró el paquete publicado solicitado.');
        }
        if (error.code === 'PACKAGE_ARCHIVE_MISSING') {
          throw new ApiError(502, 'GITHUB_PUBLISHED_ARCHIVE_MISSING', 'El índice existe pero el ZIP publicado no aparece en GitHub.');
        }
        if (error.code === 'ARCHIVE_INTEGRITY_ERROR') {
          throw new ApiError(502, 'PACKAGE_ARCHIVE_HASH_MISMATCH', 'El ZIP publicado no coincide con el tamaño o hash del índice.');
        }
      }
      throw error;
    }
  }

  async getAllIndexes(): Promise<PublishIndex[]> {
    return Promise.all(PHASE_SEQUENCE.map((phase) => this.getPhaseIndex(phase)));
  }

  async getProjectState(): Promise<{ phases: ProjectPhase[]; audit: PhaseAuditEntry[] } | null> {
    if (!this.projectStateStore) return null;
    try {
      const state = await this.projectStateStore.getProjectState();
      if (state === null) return null;
      return { phases: state.phases as ProjectPhase[], audit: state.audit as PhaseAuditEntry[] };
    } catch (error) {
      if (error instanceof ProjectStateError && error.code === 'PHASES_INVALID') {
        throw new ApiError(502, 'GITHUB_PHASES_INVALID', 'El estado de fases publicado tiene una estructura inválida.');
      }
      throw error;
    }
  }

  async publishPackage(input: {
    phase: PhaseType;
    entry: PublishIndexEntry;
    archive: Uint8Array;
    checkpointFiles?: GitHubCheckpointFile[];
  }): Promise<{ alreadyPublished: boolean; index: PublishIndex }> {
    const { phase, entry, archive, checkpointFiles = [] } = input;
    if (phase === 'PRODUCTS') {
      const expectedFirstBlock = (entry.packageId - 1) * 100;
      if (!Number.isSafeInteger(entry.packageId) || entry.packageId < 1
        || entry.filename !== this.filename(phase, entry.packageId)
        || entry.firstLogicalBlock !== expectedFirstBlock || entry.lastLogicalBlock !== expectedFirstBlock + 99
        || entry.blockCount !== 100 || !Number.isSafeInteger(entry.blockSize) || entry.blockSize < 1
        || entry.products?.strategyVersion !== 'products-package-v1'
        || entry.products?.taskContractVersion !== 'prime-product-task-v1'
        || entry.products?.validatorVersion !== 'prime-product-validator-v1'
        || entry.products?.sourcePackageId !== entry.packageId
        || !entry.products?.sourceJobId?.trim()) {
        throw new ApiError(400, 'INVALID_PRODUCTS_PUBLICATION_ENTRY', 'La entrada PRODUCTS debe identificar el paquete fuente correspondiente y sus 100 bloques consecutivos.');
      }
      if (archive.byteLength !== entry.sizeBytes
        || createHash('sha256').update(archive).digest('hex') !== entry.sha256) {
        throw new ApiError(400, 'PRODUCTS_ARCHIVE_HASH_MISMATCH', 'El tamaño o SHA-256 del ZIP PRODUCTS no coincide con la entrada que se publicará.');
      }
    }
    const result = await this.publishPackageViaStore({
      phase,
      entry,
      archive,
      onExisting: async (existing) => {
        if (phase === 'PRODUCTS' && !sameProductsPublication(existing, entry)) {
          throw new ApiError(409, 'PRODUCTS_PACKAGE_ID_CONFLICT', 'El ID PRODUCTS ya está publicado con otro ZIP o metadata de paquete fuente.');
        }
      },
      onAlreadyPublished: async () => {
        for (const file of checkpointFiles) {
          const currentContent = await this.readFile(file.path);
          const expectedContent = this.checkpointContent(file.content);
          if (currentContent !== expectedContent && !this.isNewerCheckpointPointer(file.path, currentContent, expectedContent)) {
            // Issue 33: checkpoint faltante o distinto tras una publicación ya
            // existente → no abortar. El commit final reescribe todos los
            // checkpointFiles de forma idempotente (contenido determinista e
            // inmutable), así que el reintento repara el hueco automáticamente.
          }
        }
      },
      beforeRegister: async () => {
        if (phase === 'PRODUCTS') {
          const packages = await this.publishIndexStore!.getPublishedPackages(phase);
          if (entry.packageId !== packages.length + 1) {
            throw new ApiError(409, 'PRODUCTS_PACKAGE_SEQUENCE_GAP', `PRODUCTS debe publicarse en orden: el siguiente ID permitido es ${packages.length + 1}.`);
          }
        }
        if (checkpointFiles.length) await this.validatePackageCheckpointFiles(phase, entry, checkpointFiles);
      },
    });
    // Issue 33: los checkpoints se publican siempre que existan, con o sin
    // alreadyPublished. Así el reintento cura los huecos dejados por un fallo
    // entre el commit del store (ZIP+índice) y el commit de checkpoints.
    if (checkpointFiles.length) {
      await this.commitFiles(checkpointFiles.map((file) => ({
        path: file.path,
        base64: Buffer.from(file.content).toString('base64'),
      })), `Publish ${phase} package ${entry.packageId} checkpoints`);
    }
    return { alreadyPublished: result.alreadyPublished, index: result.index };
  }

  /**
   * Helper temporal (issue 30): encapsula únicamente la parte STORAGE de
   * publishPackage() usando PublishIndexStore. La lógica de negocio y de
   * checkpoints permanece en publishPackage() y se intercala mediante callbacks.
   */
  private async publishPackageViaStore(input: {
    phase: PhaseType;
    entry: PublishIndexEntry;
    archive: Uint8Array;
    onExisting: (existing: PublishIndexEntry) => Promise<void>;
    onAlreadyPublished: () => Promise<void>;
    beforeRegister: () => Promise<void>;
  }): Promise<{ alreadyPublished: boolean; index: PublishIndex }> {
    const { phase, entry, archive } = input;
    if (!this.publishIndexStore) {
      throw new ApiError(503, 'GITHUB_NOT_CONFIGURED', 'Configura GITHUB_OWNER, GITHUB_REPOSITORY, GITHUB_BRANCH y GITHUB_TOKEN en el backend.');
    }
    const existing = await this.publishIndexStore.getPublishedPackage(phase, entry.packageId);
    if (existing) {
      await input.onExisting(existing);
      if (existing.sha256 === entry.sha256) {
        try {
          await this.publishIndexStore.verifyPublishedArchive(phase, entry.packageId);
        } catch (error) {
          if (error instanceof PublishIndexError) {
            if (error.code === 'PACKAGE_ARCHIVE_MISSING') {
              throw new ApiError(502, 'GITHUB_PUBLISHED_ARCHIVE_MISSING', 'El índice existe pero el ZIP publicado no aparece en GitHub.');
            }
            if (error.code === 'ARCHIVE_INTEGRITY_ERROR') {
              throw new ApiError(502, 'GITHUB_PUBLISHED_ARCHIVE_MISMATCH', phase === 'PRODUCTS'
                ? 'El ZIP PRODUCTS existente no coincide con el tamaño o hash de su índice.'
                : 'El ZIP publicado no coincide con el tamaño o hash de su índice.');
            }
          }
          throw error;
        }
        await input.onAlreadyPublished();
        return { alreadyPublished: true, index: await this.getPhaseIndex(phase) };
      }
      throw new ApiError(409, phase === 'PRODUCTS' ? 'PRODUCTS_PACKAGE_ID_CONFLICT' : 'PACKAGE_PUBLISH_CONFLICT',
        phase === 'PRODUCTS' ? 'El ID PRODUCTS ya está publicado con otro SHA-256.' : 'Ya existe el identificador de paquete con otro SHA-256.');
    }
    await input.beforeRegister();
    const storeInput: PublishPackageInput = {
      phase,
      packageId: entry.packageId,
      archive,
      blockRange: { first: entry.firstLogicalBlock, size: entry.blockCount },
      blockSize: entry.blockSize,
      generatorVersion: entry.generatorVersion,
      wheelVersion: entry.wheelVersion,
      products: entry.products ? {
        strategyVersion: entry.products.strategyVersion,
        taskContractVersion: entry.products.taskContractVersion,
        validatorVersion: entry.products.validatorVersion,
        sourceJobId: entry.products.sourceJobId,
        sourceBlockIndex: entry.products.sourceBlockIndex,
        sourcePrimeHash: entry.products.sourcePrimeHash,
      } : undefined,
    };
    try {
      const registered = await this.publishIndexStore.registerPublishedPackage(storeInput);
      return { alreadyPublished: false, index: registered.index };
    } catch (error) {
      if (error instanceof PublishIndexError && error.code === 'ARCHIVE_EXISTS_UNINDEXED') {
        throw new ApiError(409, phase === 'PRODUCTS' ? 'PRODUCTS_ARCHIVE_CONFLICT' : 'PACKAGE_PUBLISH_CONFLICT',
          phase === 'PRODUCTS' ? 'El ZIP PRODUCTS ya existe en GitHub pero no figura en el índice; no se sobrescribirá.' : 'El ZIP existe en GitHub pero no figura en el índice de fase.');
      }
      throw error;
    }
  }

  async listCampaignIds(): Promise<string[]> {
    const response = await this.request(`/contents/campaigns?ref=${encodeURIComponent(this.options.branch)}`, { method: 'GET' }, true);
    if (response.status === 404) return [];
    if (!response.ok) throw await this.apiError(response, 'No se pudieron consultar las campañas de checkpoints.');
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) throw new ApiError(502, 'GITHUB_CAMPAIGNS_INVALID', 'La carpeta campaigns de GitHub tiene un formato inesperado.');
    return payload.flatMap((item) => isRecord(item) && item.type === 'dir' && typeof item.name === 'string'
      && CAMPAIGN_ID_PATTERN.test(item.name) ? [item.name] : []).sort();
  }

  async getCampaignCheckpoint(campaignId: string): Promise<{ pointer: CampaignCheckpointPointer; snapshot: CampaignCheckpointSnapshot }> {
    if (!this.checkpointStore) throw new ApiError(503, 'GITHUB_NOT_CONFIGURED', 'El servicio de GitHub no está configurado.');
    let result;
    try {
      result = await this.checkpointStore.getCheckpoint(campaignId);
    } catch (error) {
      if (error instanceof CampaignCheckpointError) {
        if (error.code === 'CHECKPOINT_HASH_MISMATCH') {
          throw new ApiError(502, 'GITHUB_CHECKPOINT_HASH_MISMATCH', 'El snapshot no coincide con el SHA-256 del puntero latest.');
        }
        throw new ApiError(502, 'GITHUB_CHECKPOINT_INVALID', 'El checkpoint de campaña incumple el contrato o sus referencias.');
      }
      throw error;
    }
    if (!result) throw new ApiError(404, 'CHECKPOINT_NOT_FOUND', 'La campaña no tiene un checkpoint vigente en GitHub.');
    const { pointer, snapshot } = result;
    const remoteIndex = await this.getPhaseIndex(snapshot.phase);
    if (JSON.stringify(remoteIndex) !== JSON.stringify(snapshot.packageIndex)) {
      throw new ApiError(502, 'GITHUB_CHECKPOINT_INDEX_MISMATCH', 'El índice de paquetes remoto no coincide con el snapshot de campaña.');
    }
    return { pointer, snapshot };
  }

  async getCampaignArchive(campaignId: string): Promise<{ bytes: Uint8Array; snapshot: CampaignCheckpointSnapshot }> {
    const { snapshot } = await this.getCampaignCheckpoint(campaignId);
    const bytes = await this.readBinaryFile(snapshot.artifact.path);
    if (bytes.byteLength !== snapshot.artifact.sizeBytes
      || createHash('sha256').update(bytes).digest('hex') !== snapshot.artifact.sha256) {
      throw new ApiError(502, 'GITHUB_CHECKPOINT_ARCHIVE_HASH_MISMATCH', 'El artefacto descargado no coincide con el tamaño o SHA-256 del checkpoint.');
    }
    return { bytes, snapshot };
  }

  async getCampaignPackage(campaignId: string, packageId: number): Promise<{ bytes: Uint8Array; entry: PublishIndexEntry }> {
    if (!Number.isSafeInteger(packageId) || packageId < 1) {
      throw new ApiError(400, 'INVALID_PACKAGE_ID', 'packageId debe ser un entero positivo.');
    }
    const { snapshot } = await this.getCampaignCheckpoint(campaignId);
    if (snapshot.phase !== 'PRIMES' || snapshot.jobType !== 'PRIME_SEARCH') {
      throw new ApiError(409, 'CHECKPOINT_PACKAGE_UNSUPPORTED', 'La descarga de paquetes de checkpoint solo está disponible para campañas PRIME_SEARCH.');
    }
    const entry = snapshot.packageIndex.packages.find((item) => item.packageId === packageId);
    if (!entry) throw new ApiError(404, 'CHECKPOINT_PACKAGE_NOT_FOUND', 'El paquete no pertenece al índice de la campaña.');
    const bytes = await this.readBinaryFile(`${phaseFolder(snapshot.phase)}/${entry.filename}`);
    if (bytes.byteLength !== entry.sizeBytes || createHash('sha256').update(bytes).digest('hex') !== entry.sha256) {
      throw new ApiError(502, 'CHECKPOINT_PACKAGE_HASH_MISMATCH', 'El paquete no coincide con el tamaño o SHA-256 del índice de campaña.');
    }
    return { bytes, entry };
  }

  async publishCampaignCheckpoint(input: {
    snapshot: CampaignCheckpointSnapshot;
    archive: Uint8Array;
    archivePath: string;
  }): Promise<{ pointer: CampaignCheckpointPointer; snapshotPath: string; snapshotSha256: string; alreadyPublished: boolean }> {
    const { snapshot, archive, archivePath } = input;
    const root = campaignRoot(snapshot.campaignId);
    if (snapshot.schemaVersion !== '1.0.0' || snapshot.kind !== 'campaign-checkpoint'
      || !Number.isSafeInteger(snapshot.sequence) || snapshot.sequence < 1
      || snapshot.artifact.path !== archivePath || !archivePath.startsWith(`${root}/`)
      || snapshot.artifact.sizeBytes !== archive.byteLength
      || snapshot.artifact.sha256 !== createHash('sha256').update(archive).digest('hex')) {
      throw new ApiError(400, 'INVALID_CHECKPOINT', 'El artefacto o la metadata del checkpoint no coinciden.');
    }
    const remoteIndex = await this.getPhaseIndex(snapshot.phase);
    if (JSON.stringify(remoteIndex) !== JSON.stringify(snapshot.packageIndex)) {
      throw new ApiError(409, 'CHECKPOINT_PACKAGE_INDEX_CONFLICT', 'El índice remoto de paquetes cambió; no se publicará un checkpoint desactualizado.');
    }
    const snapshotPath = `${root}/state/snapshots/checkpoint-${String(snapshot.sequence).padStart(6, '0')}.json`;
    const snapshotContent = JSON.stringify(snapshot, null, 2);
    const snapshotSha256 = createHash('sha256').update(snapshotContent).digest('hex');
    const pointer: CampaignCheckpointPointer = {
      schemaVersion: '1.0.0', campaignId: snapshot.campaignId, sequence: snapshot.sequence,
      snapshotPath, snapshotSha256, lastPublishedPackageId: snapshot.lastPublishedPackageId,
      lastPublishedLogicalBlock: snapshot.lastPublishedLogicalBlock,
      nextLogicalBlockToPublish: snapshot.nextLogicalBlockToPublish,
      jobId: snapshot.jobId, jobType: snapshot.jobType,
    };
    const pointerContent = JSON.stringify(pointer, null, 2);
    const priorText = await this.readFile(`${root}/state/latest.json`);
    if (priorText) {
      let prior: unknown;
      try { prior = JSON.parse(priorText) as unknown; } catch {
        throw new ApiError(409, 'CHECKPOINT_POINTER_CONFLICT', 'El puntero vigente no es JSON válido; se requiere reconciliación manual.');
      }
      if (isRecord(prior) && prior.sequence === snapshot.sequence) {
        const existingSnapshot = await this.readFile(snapshotPath);
        const existingArchive = await this.readBinaryFile(archivePath).catch((error: unknown) => {
          if (error instanceof ApiError && error.status === 404) return null;
          throw error;
        });
        if (existingSnapshot === snapshotContent && existingArchive && Buffer.from(existingArchive).equals(Buffer.from(archive))
          && prior.snapshotSha256 === snapshotSha256) {
          return { pointer, snapshotPath, snapshotSha256, alreadyPublished: true };
        }
        throw new ApiError(409, 'CHECKPOINT_SEQUENCE_CONFLICT', 'La secuencia del checkpoint ya existe con contenido diferente.');
      }
      if (!isRecord(prior) || prior.campaignId !== snapshot.campaignId
        || !Number.isSafeInteger(prior.sequence) || (prior.sequence as number) >= snapshot.sequence) {
        throw new ApiError(409, 'CHECKPOINT_SEQUENCE_CONFLICT', 'El checkpoint debe avanzar la secuencia vigente de la campaña.');
      }
    }
    if (await this.fileExists(snapshotPath) || await this.fileExists(archivePath)) {
      throw new ApiError(409, 'CHECKPOINT_ARTIFACT_CONFLICT', 'Ya existe una ruta inmutable del checkpoint con otro contenido.');
    }
    await this.commitFiles([
      { path: archivePath, base64: Buffer.from(archive).toString('base64') },
      { path: snapshotPath, base64: Buffer.from(snapshotContent).toString('base64') },
      { path: `${root}/state/latest.json`, base64: Buffer.from(pointerContent).toString('base64') },
    ], `Save campaign checkpoint ${snapshot.campaignId} #${snapshot.sequence}`);
    return { pointer, snapshotPath, snapshotSha256, alreadyPublished: false };
  }

  async saveProjectPhases(phases: ProjectPhase[], audit: PhaseAuditEntry[]): Promise<void> {
    if (!this.projectStateStore) {
      throw new ApiError(502, 'GITHUB_PHASES_STORE_MISSING', 'No hay store de estado de proyecto configurado.');
    }
    await this.projectStateStore.saveProjectState({ phases, audit });
  }

  private async readFile(path: string): Promise<string | null> {
    const response = await this.request(`/contents/${path}?ref=${encodeURIComponent(this.options.branch)}`, { method: 'GET' }, true);
    if (response.status === 404) return null;
    if (!response.ok) throw await this.apiError(response, 'No se pudo leer el archivo de GitHub.');
    const payload: unknown = await response.json();
    if (!isRecord(payload) || typeof payload.content !== 'string' || payload.encoding !== 'base64') {
      throw new ApiError(502, 'GITHUB_FILE_INVALID', 'GitHub devolvió un archivo con formato inesperado.');
    }
    return Buffer.from(payload.content.replace(/\s/g, ''), 'base64').toString('utf8');
  }

  private async readBinaryFile(path: string): Promise<Uint8Array> {
    const response = await this.request(`/contents/${path}?ref=${encodeURIComponent(this.options.branch)}`, {
      method: 'GET', headers: { Accept: 'application/vnd.github.raw+json' },
    }, true);
    if (response.status === 404) throw new ApiError(404, 'GITHUB_FILE_NOT_FOUND', 'No se encontró el artefacto de checkpoint en GitHub.');
    if (!response.ok) throw await this.apiError(response, 'No se pudo descargar el artefacto binario de GitHub.');
    return new Uint8Array(await response.arrayBuffer());
  }

  private async readRawTextFile(path: string): Promise<string | null> {
    const response = await this.request(`/contents/${path}?ref=${encodeURIComponent(this.options.branch)}`, {
      method: 'GET', headers: { Accept: 'application/vnd.github.raw+json' },
    }, true);
    if (response.status === 404) return null;
    if (!response.ok) throw await this.apiError(response, 'No se pudo leer el snapshot del checkpoint.');
    return Buffer.from(await response.arrayBuffer()).toString('utf8');
  }

  private checkpointContent(content: string | Uint8Array): string {
    return typeof content === 'string' ? content : Buffer.from(content).toString('utf8');
  }

  private async validatePackageCheckpointFiles(phase: PhaseType, entry: PublishIndexEntry, files: GitHubCheckpointFile[]): Promise<void> {
    const pointerFile = files.find((file) => file.path.endsWith('/state/latest.json'));
    const snapshotFile = files.find((file) => file.path.endsWith(`/state/snapshots/checkpoint-${String(entry.packageId).padStart(6, '0')}.json`));
    if (files.length !== 2 || !pointerFile || !snapshotFile) {
      throw new ApiError(400, 'INVALID_PACKAGE_CHECKPOINT', 'La publicación requiere snapshot inmutable y puntero latest.');
    }
    let pointer: unknown;
    let snapshot: unknown;
    try {
      pointer = JSON.parse(this.checkpointContent(pointerFile.content)) as unknown;
      snapshot = JSON.parse(this.checkpointContent(snapshotFile.content)) as unknown;
    } catch {
      throw new ApiError(400, 'INVALID_PACKAGE_CHECKPOINT', 'El snapshot o puntero del paquete no contiene JSON válido.');
    }
    const root = pointerFile.path.replace(/\/state\/latest\.json$/, '');
    if (!isRecord(pointer) || !isRecord(snapshot) || pointer.schemaVersion !== '1.0.0'
      || snapshot.schemaVersion !== '1.0.0' || snapshot.kind !== 'campaign-checkpoint'
      || pointer.campaignId !== snapshot.campaignId || pointer.sequence !== entry.packageId
      || snapshot.sequence !== entry.packageId || pointer.snapshotPath !== snapshotFile.path
      || pointer.snapshotSha256 !== createHash('sha256').update(this.checkpointContent(snapshotFile.content)).digest('hex')
      || pointer.lastPublishedPackageId !== entry.packageId || snapshot.lastPublishedPackageId !== entry.packageId
      || pointer.lastPublishedLogicalBlock !== entry.lastLogicalBlock || snapshot.lastPublishedLogicalBlock !== entry.lastLogicalBlock
      || pointer.nextLogicalBlockToPublish !== entry.lastLogicalBlock + 1
      || snapshot.nextLogicalBlockToPublish !== entry.lastLogicalBlock + 1
      || snapshot.phase !== phase || snapshot.jobType !== 'PRIME_SEARCH'
      || !isRecord(snapshot.artifact) || snapshot.artifact.kind !== 'PUBLISHED_PACKAGE'
      || snapshot.artifact.path !== `${phaseFolder(phase)}/${entry.filename}`
      || snapshot.artifact.sha256 !== entry.sha256 || snapshot.artifact.sizeBytes !== entry.sizeBytes
      || !isRecord(snapshot.jobState) || !isPublishIndex(snapshot.packageIndex, phase)
      || !snapshot.packageIndex.packages.some((item) => item.packageId === entry.packageId && item.sha256 === entry.sha256)) {
      throw new ApiError(400, 'INVALID_PACKAGE_CHECKPOINT', 'El snapshot/puntero no corresponde al paquete que se publicará.');
    }
    const expectedRoot = campaignRoot(String(pointer.campaignId));
    if (root !== expectedRoot || pointer.snapshotPath !== `${root}/state/snapshots/checkpoint-${String(entry.packageId).padStart(6, '0')}.json`) {
      throw new ApiError(400, 'INVALID_PACKAGE_CHECKPOINT', 'Las rutas del checkpoint no coinciden con el identificador de campaña.');
    }
    const priorText = await this.readFile(pointerFile.path);
    if (priorText) {
      let prior: unknown;
      try { prior = JSON.parse(priorText) as unknown; } catch {
        throw new ApiError(409, 'CHECKPOINT_POINTER_CONFLICT', 'El puntero vigente no es JSON válido; se requiere reconciliación.');
      }
      const expectedPreviousSequence = entry.packageId - 1;
      if (!isRecord(prior) || prior.campaignId !== pointer.campaignId
        || prior.sequence !== expectedPreviousSequence) {
        throw new ApiError(409, 'CHECKPOINT_SEQUENCE_CONFLICT', 'El checkpoint no continúa la secuencia publicada de la campaña.');
      }
    } else if (entry.packageId !== 1) {
      throw new ApiError(409, 'CHECKPOINT_SEQUENCE_CONFLICT', 'Falta el checkpoint anterior de la campaña.');
    }
  }

  private isNewerCheckpointPointer(path: string, currentContent: string | null, expectedContent: string): boolean {
    if (!currentContent || !path.endsWith('/state/latest.json')) return false;
    try {
      const current: unknown = JSON.parse(currentContent) as unknown;
      const expected: unknown = JSON.parse(expectedContent) as unknown;
      return isRecord(current) && isRecord(expected) && current.campaignId === expected.campaignId
        && Number.isSafeInteger(current.sequence) && Number.isSafeInteger(expected.sequence)
        && (current.sequence as number) > (expected.sequence as number);
    } catch { return false; }
  }

  private async fileExists(path: string): Promise<boolean> {
    const response = await this.request(`/contents/${path}?ref=${encodeURIComponent(this.options.branch)}`, { method: 'GET' }, true);
    if (response.status === 404) return false;
    if (!response.ok) throw await this.apiError(response, 'No se pudo comprobar el archivo de GitHub.');
    return true;
  }

  private async commitFiles(files: GitHubFile[], message: string): Promise<void> {
    const ref = await this.request(`/git/ref/heads/${encodeURIComponent(this.options.branch)}`, { method: 'GET' });
    if (!ref.ok) throw await this.apiError(ref, 'No se pudo leer la rama configurada de GitHub.');
    const refPayload: unknown = await ref.json();
    if (!isRecord(refPayload) || !isRecord(refPayload.object) || typeof refPayload.object.sha !== 'string') {
      throw new ApiError(502, 'GITHUB_REF_INVALID', 'GitHub devolvió una referencia de rama inválida.');
    }
    const parentSha = refPayload.object.sha;
    const commitResponse = await this.request(`/git/commits/${parentSha}`, { method: 'GET' });
    if (!commitResponse.ok) throw await this.apiError(commitResponse, 'No se pudo leer el commit actual de GitHub.');
    const parentPayload: unknown = await commitResponse.json();
    if (!isRecord(parentPayload) || !isRecord(parentPayload.tree) || typeof parentPayload.tree.sha !== 'string') {
      throw new ApiError(502, 'GITHUB_COMMIT_INVALID', 'GitHub devolvió un commit inválido.');
    }

    const treeEntries = [];
    for (const file of files) {
      const blobResponse = await this.request('/git/blobs', {
        method: 'POST',
        body: JSON.stringify({ content: file.base64, encoding: 'base64' }),
      });
      if (!blobResponse.ok) throw await this.apiError(blobResponse, 'No se pudo preparar un archivo para GitHub.');
      const blob: unknown = await blobResponse.json();
      if (!isRecord(blob) || typeof blob.sha !== 'string') throw new ApiError(502, 'GITHUB_BLOB_INVALID', 'GitHub devolvió un blob inválido.');
      treeEntries.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
    }
    const treeResponse = await this.request('/git/trees', {
      method: 'POST',
      body: JSON.stringify({ base_tree: parentPayload.tree.sha, tree: treeEntries }),
    });
    if (!treeResponse.ok) throw await this.apiError(treeResponse, 'No se pudo crear el árbol del commit GitHub.');
    const tree: unknown = await treeResponse.json();
    if (!isRecord(tree) || typeof tree.sha !== 'string') throw new ApiError(502, 'GITHUB_TREE_INVALID', 'GitHub devolvió un árbol inválido.');
    const newCommitResponse = await this.request('/git/commits', {
      method: 'POST',
      body: JSON.stringify({ message, tree: tree.sha, parents: [parentSha] }),
    });
    if (!newCommitResponse.ok) throw await this.apiError(newCommitResponse, 'No se pudo crear el commit GitHub.');
    const newCommit: unknown = await newCommitResponse.json();
    if (!isRecord(newCommit) || typeof newCommit.sha !== 'string') throw new ApiError(502, 'GITHUB_NEW_COMMIT_INVALID', 'GitHub devolvió un commit inválido.');
    const updateResponse = await this.request(`/git/refs/heads/${encodeURIComponent(this.options.branch)}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: newCommit.sha, force: false }),
    });
    if (!updateResponse.ok) {
      if (updateResponse.status === 409 || updateResponse.status === 422) {
        throw new ApiError(503, 'GITHUB_TRANSIENT_ERROR', 'La rama cambió durante la publicación; el paquete se conserva para reintentar.');
      }
      throw await this.apiError(updateResponse, 'No se pudo actualizar la rama GitHub; puede reintentarse.');
    }
  }

  private async request(path: string, init: RequestInit, allowNotFound = false): Promise<Response> {
    if (!this.isConfigured()) throw new ApiError(503, 'GITHUB_NOT_CONFIGURED', 'Configura GITHUB_OWNER, GITHUB_REPOSITORY, GITHUB_BRANCH y GITHUB_TOKEN en el backend.');
    let response: Response;
    try {
      const base = this.options.apiBaseUrl?.replace(/\/$/, '')
        ?? `https://api.github.com/repos/${encodeURIComponent(this.options.owner!)}/${encodeURIComponent(this.options.repository!)}`;
      response = await this.fetchImpl(`${base}${path}`, {
        ...init,
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${this.options.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...init.headers,
        },
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw error;
      throw new ApiError(503, 'GITHUB_TRANSIENT_ERROR', 'No se pudo conectar con GitHub; el paquete se conserva para reintentar.');
    }
    if (allowNotFound && response.status === 404) return response;
    return response;
  }

  private async apiError(response: Response, fallback: string): Promise<ApiError> {
    if (response.status === 429 || response.status >= 500) {
      return new ApiError(503, 'GITHUB_TRANSIENT_ERROR', 'GitHub no está disponible temporalmente; el paquete se conserva para reintentar.');
    }
    if (response.status === 403) {
      const reset = response.headers.get('x-ratelimit-remaining') === '0';
      return new ApiError(reset ? 503 : 502, reset ? 'GITHUB_TRANSIENT_ERROR' : 'GITHUB_FORBIDDEN', reset
        ? 'Se alcanzó temporalmente el límite de GitHub; se puede reintentar.'
        : 'GitHub rechazó el acceso. Comprueba el token y sus permisos.');
    }
    if (response.status === 404) return new ApiError(502, 'GITHUB_NOT_FOUND', 'No se encontró el repositorio, la rama o el recurso configurado en GitHub.');
    return new ApiError(502, 'GITHUB_REQUEST_FAILED', fallback);
  }
}
