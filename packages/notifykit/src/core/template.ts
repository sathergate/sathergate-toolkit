import type { TemplateDefinition } from "./types.js";

/**
 * Replace {{key}} placeholders in a template string with values from data.
 * Unknown placeholders are left as-is.
 */
export function renderTemplate(
  template: string,
  data: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return key in data ? data[key] : match;
  });
}

/**
 * Resolve a named template, rendering its subject and body with the given data.
 */
export function resolveTemplate(
  templates: Record<string, TemplateDefinition>,
  templateName: string,
  data: Record<string, string>,
): { channel: TemplateDefinition["channel"]; subject?: string; body: string } {
  const template = templates[templateName];
  if (!template) {
    throw new Error(`Template "${templateName}" not found`);
  }

  return {
    channel: template.channel,
    subject: template.subject
      ? renderTemplate(template.subject, data)
      : undefined,
    body: renderTemplate(template.body, data),
  };
}
