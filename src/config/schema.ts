import { z } from 'zod';

const ParentSchema = z.object({
  name: z.string().min(1),
  phone: z.string().regex(/^\+\d{8,15}$/, 'Phone must be E.164 format (+56912345678)'),
});

export const StudentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  parents: z.array(ParentSchema).min(1),
});

export const RotationConfigSchema = z.object({
  type: z.string().min(1),
  order: z.array(z.string().min(1)).min(1),
  currentIndex: z.number().int().min(0),
  weeklySlots: z.array(z.string().min(1)).min(1),
});

export const ClassEventSchema = z.object({
  id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  description: z.string().min(1),
  assignedTo: z.string().optional(),
  type: z.enum(['snack', 'material', 'activity', 'info']),
});

export const TestModeSchema = z.object({
  enabled: z.boolean(),
  recipientPhone: z.string().regex(/^\+\d{8,15}$/, 'Phone must be E.164 format'),
});

export const WorkspaceConfigSchema = z.object({
  groupJid: z.string().min(1),
  timezone: z.string().min(1),
  schoolName: z.string().min(1),
  className: z.string().min(1),
  testMode: TestModeSchema,
});

export const VoiceExampleSchema = z.object({
  id: z.string().min(1),
  content: z.string().min(1),
  messageType: z.string().min(1),
});

export const EnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  GCP_PROJECT_ID: z.string().min(1),
  WA_AUTH_BUCKET: z.string().min(1),
  WORKSPACE_ID: z.string().min(1),
  ADMIN_TOKEN: z.string().min(1),
  PORT: z.string().default('8080'),
});

export type Env = z.infer<typeof EnvSchema>;
