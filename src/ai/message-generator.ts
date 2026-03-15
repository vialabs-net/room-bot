import type { ClassEvent, Student, VoiceExample } from '../data/types.js';
import type { SchoolEmail } from '../gmail/scanner.js';
import { generateMessage } from './client.js';

export interface ReminderContext {
  readonly reminderType: 'daily' | 'weekly';
  readonly events: readonly ClassEvent[];
  readonly students: readonly Student[];
  readonly voiceExamples: readonly VoiceExample[];
  readonly className: string;
  readonly schoolName: string;
  readonly schoolEmails?: readonly SchoolEmail[];
  readonly weekRange?: string; // e.g. "2026-03-16 al 2026-03-20"
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
    '- Si no hay eventos ni avisos del colegio, responde SOLO con la palabra: SKIP',
    '- El mensaje debe ser completo y listo para enviar, sin placeholders',
    '- No incluyas saludos genericos innecesarios, ve al grano con calidez',
    '- Mantente concisa: los papas leen en el celular',
    '- Separa claramente: "Actividades de la semana" (fechas dentro del rango semanal indicado) vs "Mirando mas adelante" (fechas posteriores al rango)',
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
    const rangeLabel = ctx.weekRange ? ` (semana del ${ctx.weekRange})` : '';
    lines.push(`Genera un resumen semanal con todo lo que viene esta semana${rangeLabel}.`);
  }

  lines.push('', `Clase: ${ctx.className}, ${ctx.schoolName}`);

  if (ctx.schoolEmails && ctx.schoolEmails.length > 0) {
    lines.push('', 'Informativos del colegio (esta semana):');
    for (const email of ctx.schoolEmails) {
      lines.push('', `--- ${email.date} | ${email.subject} ---`, email.body);
    }
  }

  if (ctx.events.length > 0) {
    const eventsLabel = ctx.weekRange
      ? `Eventos de esta semana (${ctx.weekRange}):`
      : 'Eventos:';
    lines.push('', eventsLabel);
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

  const hasContent = ctx.events.length > 0
    || (ctx.schoolEmails && ctx.schoolEmails.length > 0);

  if (!hasContent) {
    lines.push('', 'No hay eventos ni avisos programados.');
  }

  return lines.join('\n');
}

function resolveStudentName(
  studentId: string,
  students: readonly Student[],
): string {
  const student = students.find((s) => s.id === studentId);
  return student?.name ?? studentId;
}
