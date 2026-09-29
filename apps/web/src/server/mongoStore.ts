import { MongoClient, type Db } from "mongodb";
import type { ArenaSessionDoc, ClassSessionDoc, JobDoc, Store } from "./store";

/** MongoDB-Implementierung. TTL-Indizes löschen abgelaufene Dokumente automatisch. */
export class MongoStore implements Store {
  private constructor(private db: Db) {}

  static async connect(uri: string, dbName: string): Promise<MongoStore> {
    const client = new MongoClient(uri, { appName: "guide-me-web" });
    await client.connect();
    const store = new MongoStore(client.db(dbName));
    await store.ensureIndexes();
    return store;
  }

  private get arenas() {
    return this.db.collection<ArenaSessionDoc>("arenaSessions");
  }
  private get jobs() {
    return this.db.collection<JobDoc>("jobs");
  }
  private get classes() {
    return this.db.collection<ClassSessionDoc>("classSessions");
  }

  async ensureIndexes() {
    await Promise.all([
      this.arenas.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      this.jobs.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      this.jobs.createIndex({ state: 1, createdAt: 1 }),
      this.jobs.createIndex({ arenaSessionId: 1 }),
      this.classes.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      this.classes.createIndex({ joinCode: 1 }, { unique: true }),
    ]);
  }

  getArena(id: string) {
    return this.arenas.findOne({ _id: id });
  }
  async insertArena(doc: ArenaSessionDoc) {
    try {
      await this.arenas.insertOne(doc);
      return "ok" as const;
    } catch (e) {
      if ((e as { code?: number }).code === 11000) return "exists" as const;
      throw e;
    }
  }
  async updateArena(id: string, patch: Partial<ArenaSessionDoc>) {
    await this.arenas.updateOne({ _id: id }, { $set: patch });
  }
  async deleteArena(id: string) {
    await this.arenas.deleteOne({ _id: id });
  }
  async insertJob(doc: JobDoc) {
    await this.jobs.insertOne(doc);
  }
  async deleteJobsForArena(arenaId: string) {
    await this.jobs.deleteMany({ arenaSessionId: arenaId });
  }
  getClassByCode(code: string) {
    return this.classes.findOne({ joinCode: code });
  }
  getClass(id: string) {
    return this.classes.findOne({ _id: id });
  }
}
