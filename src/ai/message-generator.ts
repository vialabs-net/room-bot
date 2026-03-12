import type { ClassEvent, RotationConfig, Student, VoiceExample } from '../data/types.js';
import { generateMessage } from './client.js';

export interface ReminderContext {
  readonly reminderType: 'daily' | 'weekly';
  readonly events: readonly ClassEvent[];
  readonly rotation: RotationConfig;
  readonly students: readonly Student[];
  readonly voiceExamples: readonly VoiceExample[];
  readonly className: string;
  readonly schoolName: string;
}

export async function generateReminder(
  apiKey: string,
  ctx: ReminderContext,
): Promise<string> {
  const systemPrompt = buildSystemPrompt(ctx.voiceExamples);
  const userPrompt = buildUserPrompt(ctx);
  return generateMessage(apiKey, systemPrompt, userPrompt);
}

function buildSystemPrompt(voiceExamples: readonly VoiceExample[]): string {
  const lines = [
    'Eres una asistente de comunicacion para una mama delegada de sala de clases en Chile.',
    'Tu trabajo es redactar mensajes de WhatsApp para el grupo de apoderados.',
    '',
    'Reglas estrictas:',
    '- Escribe en espanol chileno, tono calido y cercano',
    '- Usa emojis con moderacion pero que den vida al mensaje',
    '- Nunca inventes informacion que no este en los datos proporcionados',
    '- Si no hay eventos ni colaciones, responde SOLO con la palabra: SKIP',
    '- El mensaje debe ser completo y listo para enviar, sin placeholders',
    '- No incluyas saludos genericos innecesarios, ve al grano con calidez',
    '- Mantente concisa: los papas leen en el celular',
  ];

  if (voiceExamples.length > 0) {
    lines.push('', 'Ejemplos del estilo de escritura que debes imitar:');
    for (const ex of voiceExamples) {
      lines.push('', `--- Ejemplo (${ex.messageType}) ---`, ex.content);
    }
  }

  return lines.join('\n');
}

function buildUserPrompt(ctx: ReminderContext): string {
  const lines: string[] = [];

  if (ctx.reminderType === 'daily') {
    lines.push('Genera un mensaje de recordatorio para MANANA.');
  } else {
    lines.push('Genera un resumen semanal con todo lo que viene esta semana.');
  }

  lines.push('', `Clase: ${ctx.className}, ${ctx.schoolName}`);

  if (ctx.events.length > 0) {
    lines.push('', 'Eventos:');
    for (const ev of ctx.events) {
      lines.push(`- ${ev.date} | ${ev.type} | ${ev.description}`);
      for (const item of ev.items) {
        const assignedName = item.assignedTo
          ? resolveStudentName(item.assignedTo, ctx.students)
          : 'sin asignar';
        lines.push(`  * ${item.name}: ${assignedName}`);
      }
    }
  }

  const snackStudents = resolveSnackStudents(ctx);
  if (snackStudents.length > 0) {
    lines.push('', 'Colaciones (rotacion):');
    for (const entry of snackStudents) {
      lines.push(`- ${entry.day}: ${entry.studentName}`);
    }
  }

  if (ctx.events.length === 0 && snackStudents.length === 0) {
    lines.push('', 'No hay eventos ni colaciones programadas.');
  }

  return lines.join('\n');
}

interface SnackEntry {
  readonly day: string;
  readonly studentName: string;
}

function resolveSnackStudents(ctx: ReminderContext): SnackEntry[] {
  const { rotation, students } = ctx;
  if (rotation.type !== 'snack' || rotation.weeklySlots.length === 0) return [];

  const slots = ctx.reminderType === 'daily'
    ? rotation.weeklySlots.slice(0, 1)
    : rotation.weeklySlots;

  const entries: SnackEntry[] = [];
  let idx = rotation.currentIndex;

  for (const day of slots) {
    const studentId = rotation.order[idx % rotation.order.length];
    if (studentId) {
      entries.push({
        day,
        studentName: resolveStudentName(studentId, students),
      });
    }
    idx++;
  }

  return entries;
}

function resolveStudentName(
  studentId: string,
  students: readonly Student[],
): string {
  const student = students.find((s) => s.id === studentId);
  return student?.name ?? studentId;
}
