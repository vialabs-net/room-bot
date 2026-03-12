export interface Parent {
  readonly name: string;
  readonly phone: string;
}

export interface Student {
  readonly id: string;
  readonly name: string;
  readonly parents: readonly Parent[];
}

export interface RotationConfig {
  readonly type: string;
  readonly order: readonly string[];
  readonly currentIndex: number;
  readonly weeklySlots: readonly string[];
}

export type EventType = 'snack' | 'material' | 'activity' | 'info';

export interface ClassEvent {
  readonly id: string;
  readonly date: string;
  readonly description: string;
  readonly assignedTo?: string;
  readonly type: EventType;
}

export type DraftStatus = 'pending_approval' | 'approved' | 'sent' | 'expired';
export type ReminderType = 'daily' | 'weekly' | 'adhoc';

export interface Draft {
  readonly id: string;
  readonly message: string;
  readonly status: DraftStatus;
  readonly reminderType: ReminderType;
  readonly createdAt: Date;
  readonly sentAt?: Date;
}

export interface TestMode {
  readonly enabled: boolean;
  readonly recipientPhone: string;
}

export interface WorkspaceConfig {
  readonly groupJid: string;
  readonly timezone: string;
  readonly schoolName: string;
  readonly className: string;
  readonly testMode: TestMode;
}

export interface VoiceExample {
  readonly id: string;
  readonly content: string;
  readonly messageType: string;
}
