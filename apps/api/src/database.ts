import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, types } from 'pg';
// Laravel's timestamp without time zone values represent Caracas wall time.
types.setTypeParser(1114, (value) => value);

export interface Sql {
  query(text: string, values?: any[]): Promise<{ rows: any[]; rowCount?: number | null }>;
}
@Injectable()
export class Database implements Sql, OnModuleDestroy {
  private pool?: Pool;
  private get connection() {
    if (!process.env.DATABASE_URL)
      throw new Error('Configura DATABASE_URL antes de conectar a PostgreSQL.');
    return (this.pool ??= new Pool({
      connectionString: process.env.DATABASE_URL,
      options: '-c timezone=America/Caracas',
      max: 3,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
    }));
  }
  query(text: string, values: any[] = []) {
    return this.connection.query(text, values);
  }
  async transaction<T>(work: (sql: Sql) => Promise<T>): Promise<T> {
    const client = await this.connection.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  async onModuleDestroy() {
    await this.pool?.end();
  }
}
