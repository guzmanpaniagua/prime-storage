export interface ProjectState<TPhase = unknown, TAudit = unknown> {
  phases: TPhase[];
  audit: TAudit[];
}
