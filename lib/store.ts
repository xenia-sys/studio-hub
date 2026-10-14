import type { Workspace } from './domain.ts';

export type StoredWorkspace = { state: Workspace; revision: number };

/** Atomic compare-and-swap keeps two managers from overwriting each other. */
export interface WorkspaceStore {
  read(): Promise<StoredWorkspace | null>;
  initialize(state: Workspace): Promise<void>;
  compareAndSwap(state: Workspace, revision: number): Promise<boolean>;
}
