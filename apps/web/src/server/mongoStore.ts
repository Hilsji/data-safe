import { MongoClient, type Db } from "mongodb";
import type {
  ArenaSessionDoc,
  ClassAggregateDoc,
  ClassGroup,
  ClassSessionDoc,
  ContributionTokenDoc,
  JobDoc,
  CalibrationDoc,
  PoliticsApprovalDoc,
  RaterTagDoc,
  LoginTokenDoc,
  ParticipantDoc,
  Store,
  UserSessionDoc,
} from "./store";
import { emptyAggregate } from "./store";

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
  private get participants() {
    return this.db.collection<ParticipantDoc>("classParticipants");
  }
  private get tokens() {
    return this.db.collection<ContributionTokenDoc>("contributionTokens");
  }
  private get aggregates() {
    return this.db.collection<ClassAggregateDoc>("classAggregates");
  }
  private get loginTokens() {
    return this.db.collection<LoginTokenDoc>("loginTokens");
  }
  private get sessions() {
    return this.db.collection<UserSessionDoc>("userSessions");
  }
  private get calibrations() {
    return this.db.collection<CalibrationDoc>("calibrationRecordings");
  }
  private get raterTags() {
    return this.db.collection<RaterTagDoc>("raterTags");
  }
  private get settings() {
    return this.db.collection<PoliticsApprovalDoc>("settings");
  }

  async ensureIndexes() {
    await Promise.all([
      this.arenas.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      this.jobs.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      this.jobs.createIndex({ state: 1, createdAt: 1 }),
      this.jobs.createIndex({ arenaSessionId: 1 }),
      this.classes.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      this.classes.createIndex({ joinCode: 1 }, { unique: true }),
      this.classes.createIndex({ teacherId: 1 }),
      this.arenas.createIndex({ classSessionId: 1 }),
      ...["classParticipants", "contributionTokens", "classAggregates", "loginTokens", "userSessions"].map((name) =>
        this.db.collection(name).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      ),
      this.participants.createIndex({ classId: 1 }),
      this.aggregates.createIndex({ classId: 1 }),
      this.raterTags.createIndex({ recordingId: 1, raterId: 1 }),
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
  async insertClass(doc: ClassSessionDoc) {
    try {
      await this.classes.insertOne(doc);
      return "ok" as const;
    } catch (e) {
      if ((e as { code?: number }).code === 11000) return "exists" as const;
      throw e;
    }
  }
  async updateClass(id: string, patch: Partial<ClassSessionDoc>) {
    await this.classes.updateOne({ _id: id }, { $set: patch });
  }
  async nextJoinIndex(classId: string) {
    const before = await this.classes.findOneAndUpdate({ _id: classId }, { $inc: { joinCount: 1 } }, { returnDocument: "before" });
    return before ? (before.joinCount ?? 0) : null;
  }
  listClasses(teacherId: string) {
    return this.classes.find({ teacherId }).sort({ createdAt: -1 }).toArray();
  }
  async deleteClass(id: string) {
    await Promise.all([
      this.classes.deleteOne({ _id: id }),
      this.participants.deleteMany({ classId: id }),
      this.tokens.deleteMany({ classId: id }),
      this.aggregates.deleteMany({ classId: id }),
      this.arenas.updateMany({ classSessionId: id }, { $set: { classSessionId: null } }),
    ]);
  }
  async insertParticipant(doc: ParticipantDoc) {
    await this.participants.insertOne(doc);
  }
  listParticipants(classId: string) {
    return this.participants.find({ classId }).toArray();
  }
  async insertContributionToken(doc: ContributionTokenDoc) {
    await this.tokens.insertOne(doc);
  }
  consumeContributionToken(hash: string) {
    return this.tokens.findOneAndDelete({ _id: hash });
  }
  async incAggregate(key: { classId: string; groupId: ClassGroup["id"] }, inc: Record<string, number>, expiresAt: Date) {
    const _id = `${key.classId}:${key.groupId}`;
    // Dokument mit festen Arrays anlegen, falls es fehlt – danach nur noch $inc
    const init: Partial<ClassAggregateDoc> = emptyAggregate(key.classId, key.groupId, expiresAt);
    delete init._id;
    await this.aggregates.updateOne({ _id }, { $setOnInsert: init }, { upsert: true });
    await this.aggregates.updateOne({ _id }, { $inc: inc });
  }
  getAggregates(classId: string) {
    return this.aggregates.find({ classId }).toArray();
  }
  async countArenasByStatus(classId: string) {
    const rows = await this.arenas.aggregate<{ _id: string; n: number }>([
      { $match: { classSessionId: classId } },
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]).toArray();
    return Object.fromEntries(rows.map((r) => [r._id, r.n]));
  }
  async insertLoginToken(doc: LoginTokenDoc) {
    await this.loginTokens.insertOne(doc);
  }
  consumeLoginToken(hash: string) {
    return this.loginTokens.findOneAndDelete({ _id: hash, expiresAt: { $gt: new Date() } });
  }
  async insertUserSession(doc: UserSessionDoc) {
    await this.sessions.insertOne(doc);
  }
  getUserSession(hash: string) {
    return this.sessions.findOne({ _id: hash, expiresAt: { $gt: new Date() } });
  }
  async deleteUserSession(hash: string) {
    await this.sessions.deleteOne({ _id: hash });
  }
  async insertCalibration(doc: CalibrationDoc) {
    await this.calibrations.insertOne(doc);
  }
  listCalibrations() {
    return this.calibrations.find({}, { projection: { segments: 0 } }).sort({ createdAt: -1 }).toArray();
  }
  getCalibration(id: string) {
    return this.calibrations.findOne({ _id: id });
  }
  async deleteCalibration(id: string) {
    await Promise.all([this.calibrations.deleteOne({ _id: id }), this.raterTags.deleteMany({ recordingId: id })]);
  }
  async upsertRaterTag(doc: RaterTagDoc) {
    await this.raterTags.replaceOne({ _id: doc._id }, doc, { upsert: true });
  }
  listRaterTags(filter: { recordingId?: string; raterId?: string }) {
    const q: Record<string, string> = {};
    if (filter.recordingId) q.recordingId = filter.recordingId;
    if (filter.raterId) q.raterId = filter.raterId;
    return this.raterTags.find(q).toArray();
  }
  async getPoliticsApproval() {
    return (await this.settings.findOne({ _id: "politics" })) ?? { _id: "politics" as const, approvedModelVersion: null, approvedAt: null, approvedBy: null };
  }
  async setPoliticsApproval(doc: PoliticsApprovalDoc) {
    await this.settings.replaceOne({ _id: "politics" }, doc, { upsert: true });
  }
}
