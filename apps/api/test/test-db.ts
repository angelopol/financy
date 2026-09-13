import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Database, Sql } from '../src/database';
export class TestDatabase extends Database {
  readonly pg = new PGlite({ parsers: { 1114: (v) => v, 1700: (v) => v, 20: (v) => v } });
  async setup() {
    await this.pg.exec(
      "SET timezone='America/Caracas';" +
        readFileSync(resolve('database/001_schema.sql'), 'utf8') +
        readFileSync(resolve('database/002_ai.sql'), 'utf8') +
        readFileSync(resolve('database/003_users_name.sql'), 'utf8'),
    );
  }
  override async query(text: string, values: any[] = []): Promise<any> {
    return this.pg.query(text, values);
  }
  override transaction<T>(work: (sql: Sql) => Promise<T>): Promise<T> {
    return this.pg.transaction((tx) =>
      work({ query: (text, values = []) => tx.query(text, values) }),
    );
  }
  override async onModuleDestroy() {
    if (!this.pg.closed) await this.pg.close();
  }
}
