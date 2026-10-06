import Database from "better-sqlite3";

export class MockPreparedStatement {
  constructor(public readonly stmt: Database.Statement, public readonly boundArgs: any[] = []) {}

  bind(...args: any[]): MockPreparedStatement {
    return new MockPreparedStatement(this.stmt, args);
  }

  async first<T = unknown>(colName?: string): Promise<T | null> {
    const row = this.stmt.get(...this.boundArgs) as any;
    if (!row) return null;
    if (colName) return row[colName] ?? null;
    return row as T;
  }

  async all<T = unknown>(): Promise<D1Result<T>> {
    const rows = this.stmt.all(...this.boundArgs) as T[];
    return {
      results: rows,
      success: true,
      meta: {} as any,
    };
  }

  async run<T = unknown>(): Promise<D1Response> {
    const info = this.stmt.run(...this.boundArgs);
    return {
      success: true,
      meta: {
        changes: info.changes,
        last_row_id: Number(info.lastInsertRowid),
      } as any,
    };
  }
}

export function createMockD1(rawDb: Database.Database): D1Database {
  return {
    prepare(query: string) {
      return new MockPreparedStatement(rawDb.prepare(query)) as any;
    },
    async batch<T = unknown>(statements: any[]): Promise<D1Result<T>[]> {
      const results: D1Result<T>[] = [];
      const tx = rawDb.transaction(() => {
        for (const s of statements) {
          const stmt = (s as MockPreparedStatement).stmt;
          const args = (s as MockPreparedStatement).boundArgs;
          stmt.run(...args);
          results.push({ results: [], success: true, meta: {} as any });
        }
      });
      tx();
      return results;
    },
    async exec(query: string) {
      rawDb.exec(query);
      return { count: 1, duration: 0 };
    },
    async dump() {
      throw new Error("not implemented");
    },
    withSession(_token?: string): any {
      return { ...createMockD1(rawDb), getBookmark: () => null };
    },
  };
}
