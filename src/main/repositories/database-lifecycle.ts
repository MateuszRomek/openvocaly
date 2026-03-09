import { initDb } from '../db'

/**
 * Explicit database lifecycle owner for main-process composition root.
 */
export class DatabaseLifecycle {
  initialize(): void {
    initDb()
  }
}
