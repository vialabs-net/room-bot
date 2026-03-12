import { Firestore } from '@google-cloud/firestore';
import type {
  ClassEvent,
  Draft,
  DraftStatus,
  EventItem,
  EventStatus,
  EventType,
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
    const data = doc.data()!;
    return {
      type: data['type'] as string,
      order: data['order'] as string[],
      currentIndex: data['currentIndex'] as number,
      deferred: (data['deferred'] as string[] | undefined) ?? [],
      weeklySlots: data['weeklySlots'] as string[],
    };
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

  async assignStudentsToEvent(eventId: string): Promise<ClassEvent> {
    const rotRef = this.db.doc(`workspaces/${this.workspaceId}/rotation/config`);
    const eventRef = this.col('events').doc(eventId);

    return this.db.runTransaction(async (tx) => {
      const [rotDoc, eventDoc] = await Promise.all([tx.get(rotRef), tx.get(eventRef)]);
      if (!rotDoc.exists) throw new Error('Rotation config not found');
      if (!eventDoc.exists) throw new Error('Event not found');

      const rot = rotDoc.data()!;
      const event = eventDoc.data()!;
      const items = (event['items'] as EventItem[]) ?? [];

      if (items.length === 0) throw new Error('Event has no items to assign');

      const order = rot['order'] as string[];
      const deferred = [...((rot['deferred'] as string[] | undefined) ?? [])];
      let currentIndex = rot['currentIndex'] as number;
      const assigned: EventItem[] = [];
      const usedFromDeferred: string[] = [];

      for (const item of items) {
        let studentId: string | undefined;

        if (deferred.length > 0) {
          studentId = deferred.shift()!;
          usedFromDeferred.push(studentId);
        } else {
          studentId = order[currentIndex % order.length];
          currentIndex = (currentIndex + 1) % order.length;
        }

        assigned.push({ name: item.name, assignedTo: studentId });
      }

      tx.update(rotRef, {
        currentIndex,
        deferred: deferred.filter((d) => !usedFromDeferred.includes(d)),
      });
      tx.update(eventRef, { items: assigned, status: 'assigned' as EventStatus });

      return {
        id: eventId,
        date: event['date'] as string,
        description: event['description'] as string,
        type: event['type'] as EventType,
        items: assigned,
        status: 'assigned' as EventStatus,
      };
    });
  }

  async replaceInEvent(eventId: string, sickStudentId: string): Promise<{ replacementId: string; event: ClassEvent }> {
    const rotRef = this.db.doc(`workspaces/${this.workspaceId}/rotation/config`);
    const eventRef = this.col('events').doc(eventId);

    return this.db.runTransaction(async (tx) => {
      const [rotDoc, eventDoc] = await Promise.all([tx.get(rotRef), tx.get(eventRef)]);
      if (!rotDoc.exists) throw new Error('Rotation config not found');
      if (!eventDoc.exists) throw new Error('Event not found');

      const rot = rotDoc.data()!;
      const event = eventDoc.data()!;
      const items = [...((event['items'] as EventItem[]) ?? [])];

      const sickItemIndex = items.findIndex((item) => item.assignedTo === sickStudentId);
      if (sickItemIndex === -1) throw new Error('Student not assigned to this event');

      const order = rot['order'] as string[];
      const deferred = [...((rot['deferred'] as string[] | undefined) ?? [])];
      let currentIndex = rot['currentIndex'] as number;

      const replacementId = order[currentIndex % order.length]!;
      currentIndex = (currentIndex + 1) % order.length;

      items[sickItemIndex] = { name: items[sickItemIndex]!.name, assignedTo: replacementId };

      deferred.push(sickStudentId);

      tx.update(rotRef, { currentIndex, deferred });
      tx.update(eventRef, { items });

      const updatedEvent: ClassEvent = {
        id: eventId,
        date: event['date'] as string,
        description: event['description'] as string,
        type: event['type'] as EventType,
        items,
        status: event['status'] as EventStatus,
      };

      return { replacementId, event: updatedEvent };
    });
  }

  // --- Events ---

  async getEvent(id: string): Promise<ClassEvent | null> {
    const doc = await this.col('events').doc(id).get();
    if (!doc.exists) return null;
    const data = doc.data()!;
    return {
      id: doc.id,
      date: data['date'] as string,
      description: data['description'] as string,
      type: (data['type'] as EventType) ?? 'info',
      items: (data['items'] as EventItem[]) ?? [],
      status: (data['status'] as EventStatus) ?? 'draft',
    };
  }

  async listEventsByDateRange(from: string, to: string): Promise<ClassEvent[]> {
    const snap = await this.col('events')
      .where('date', '>=', from)
      .where('date', '<=', to)
      .orderBy('date')
      .get();
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        date: data['date'] as string,
        description: data['description'] as string,
        type: (data['type'] as EventType) ?? 'info',
        items: (data['items'] as EventItem[]) ?? [],
        status: (data['status'] as EventStatus) ?? 'draft',
      };
    });
  }

  async addEvent(event: { date: string; description: string; type: EventType; items: EventItem[] }): Promise<string> {
    const ref = await this.col('events').add({
      ...event,
      status: 'draft' as EventStatus,
    });
    return ref.id;
  }

  async updateEventStatus(id: string, status: EventStatus): Promise<void> {
    await this.col('events').doc(id).update({ status });
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
