import { Firestore } from '@google-cloud/firestore';
import type {
  ClassEvent,
  Draft,
  DraftStatus,
  ReminderType,
  RotationConfig,
  Student,
  VoiceExample,
  WorkspaceConfig,
} from './types.js';

export class WorkspaceStore {
  private readonly db: Firestore;
  private readonly workspaceId: string;

  constructor(db: Firestore, workspaceId: string) {
    this.db = db;
    this.workspaceId = workspaceId;
  }

  private col(name: string) {
    return this.db.collection(`workspaces/${this.workspaceId}/${name}`);
  }

  // --- Config ---

  async getConfig(): Promise<WorkspaceConfig> {
    const doc = await this.db.doc(`workspaces/${this.workspaceId}/config/main`).get();
    if (!doc.exists) {
      throw new Error(`Workspace config not found: ${this.workspaceId}`);
    }
    return doc.data() as WorkspaceConfig;
  }

  // --- Students ---

  async listStudents(): Promise<Student[]> {
    const snap = await this.col('students').orderBy('name').get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Student);
  }

  async getStudent(id: string): Promise<Student | null> {
    const doc = await this.col('students').doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as Student;
  }

  // --- Rotation ---

  async getRotation(): Promise<RotationConfig> {
    const doc = await this.db.doc(`workspaces/${this.workspaceId}/rotation/config`).get();
    if (!doc.exists) {
      throw new Error(`Rotation config not found: ${this.workspaceId}`);
    }
    return doc.data() as RotationConfig;
  }

  async advanceRotation(steps: number): Promise<number> {
    const ref = this.db.doc(`workspaces/${this.workspaceId}/rotation/config`);
    const newIndex = await this.db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      if (!doc.exists) throw new Error('Rotation config not found');
      const data = doc.data() as RotationConfig;
      const next = (data.currentIndex + steps) % data.order.length;
      tx.update(ref, { currentIndex: next });
      return next;
    });
    return newIndex;
  }

  async swapStudents(idA: string, idB: string): Promise<readonly string[]> {
    const ref = this.db.doc(`workspaces/${this.workspaceId}/rotation/config`);
    const newOrder = await this.db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      if (!doc.exists) throw new Error('Rotation config not found');
      const data = doc.data() as RotationConfig;
      const order = [...data.order];
      const indexA = order.indexOf(idA);
      const indexB = order.indexOf(idB);
      if (indexA === -1) throw new Error(`Student ${idA} not found in rotation`);
      if (indexB === -1) throw new Error(`Student ${idB} not found in rotation`);
      order[indexA] = idB;
      order[indexB] = idA;
      tx.update(ref, { order });
      return order;
    });
    return newOrder;
  }

  async skipCurrentStudent(): Promise<{ skippedId: string; newIndex: number }> {
    const ref = this.db.doc(`workspaces/${this.workspaceId}/rotation/config`);
    return this.db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      if (!doc.exists) throw new Error('Rotation config not found');
      const data = doc.data() as RotationConfig;
      const order = [...data.order];
      const skippedId = order[data.currentIndex];
      if (!skippedId) throw new Error('No student at current index');
      order.splice(data.currentIndex, 1);
      order.push(skippedId);
      tx.update(ref, { order, currentIndex: data.currentIndex % order.length });
      return { skippedId, newIndex: data.currentIndex % order.length };
    });
  }

  // --- Events ---

  async listEventsByDateRange(from: string, to: string): Promise<ClassEvent[]> {
    const snap = await this.col('events')
      .where('date', '>=', from)
      .where('date', '<=', to)
      .orderBy('date')
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ClassEvent);
  }

  async addEvent(event: Omit<ClassEvent, 'id'>): Promise<string> {
    const ref = await this.col('events').add(event);
    return ref.id;
  }

  // --- Drafts ---

  async createDraft(message: string, reminderType: ReminderType): Promise<string> {
    const ref = await this.col('drafts').add({
      message,
      status: 'pending_approval' as DraftStatus,
      reminderType,
      createdAt: new Date(),
    });
    return ref.id;
  }

  async getDraft(id: string): Promise<Draft | null> {
    const doc = await this.col('drafts').doc(id).get();
    if (!doc.exists) return null;
    const data = doc.data()!;
    return {
      id: doc.id,
      message: data['message'] as string,
      status: data['status'] as DraftStatus,
      reminderType: data['reminderType'] as ReminderType,
      createdAt: (data['createdAt'] as FirebaseFirestore.Timestamp).toDate(),
      sentAt: data['sentAt']
        ? (data['sentAt'] as FirebaseFirestore.Timestamp).toDate()
        : undefined,
    };
  }

  async updateDraftStatus(id: string, status: DraftStatus): Promise<void> {
    const update: Record<string, unknown> = { status };
    if (status === 'sent') {
      update['sentAt'] = new Date();
    }
    await this.col('drafts').doc(id).update(update);
  }

  async updateDraftMessage(id: string, message: string): Promise<void> {
    await this.col('drafts').doc(id).update({ message });
  }

  // --- Voice Examples ---

  async listVoiceExamples(): Promise<VoiceExample[]> {
    const snap = await this.col('voice').get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as VoiceExample);
  }
}
