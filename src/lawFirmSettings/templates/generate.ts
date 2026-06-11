// Action Templates — document generation (SCAFFOLD).
//
// This is the real implementation of the three document-producing action
// handlers (send_lor / request_records / request_bills). It REUSES the
// taskCatalog engine (routeTask + the already-resolved automationMode) rather
// than forking it: disposition comes straight from routeTask(task).
//
// Architectural note: generation lives here, not inside taskCatalog/engine.ts.
// The catalog engine is deliberately standalone (it knows nothing about
// templates or the queue); having it import templates + the send queue would
// couple the lean model to this feature. So generation imports DOWN into the
// engine (one-way, no cycle) and the engine's textual ACTION_HANDLERS stay as
// the "what would happen" preview for non-document actions.

import type { FirmTask } from '../taskCatalog/types';
import { routeTask } from '../taskCatalog/engine';
import type { Carrier, FirmProfile, Matter, Provider } from '../seedMatter';
import type { DocTemplate, TemplateActionType } from '../templates/types';
import { buildMergeContext, carrierContext, providerContext, renderTemplate } from '../templates/mergeContext';
import type { QueueItem } from '../sendQueue/types';
import { enqueue, releaseItem } from '../sendQueue/queue';

let seq = 0;
const nextId = () => `q-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export interface FirmContext {
  profile: FirmProfile;
  templates: DocTemplate[]; // current set (firm overrides + defaults)
}

const DOC_ACTIONS: TemplateActionType[] = ['send_lor', 'request_records', 'request_bills'];

export function isDocAction(action: string): action is TemplateActionType {
  return DOC_ACTIONS.includes(action as TemplateActionType);
}

// Pick the firm's template for an action: a non-default (customized) one wins
// over the seeded default.
function pickTemplate(templates: DocTemplate[], action: TemplateActionType): DocTemplate | undefined {
  const forAction = templates.filter((t) => t.actionType === action);
  return forAction.find((t) => !t.isFirmDefault) ?? forAction.find((t) => t.isFirmDefault) ?? forAction[0];
}

// Generate one queue item per recipient for a document-producing task, enqueue
// each, and auto-release when the task routes to 'execute' (auto + opted-in).
// Returns the items created. Non-document tasks produce nothing here.
export function generateDocuments(task: FirmTask, matter: Matter, firm: FirmContext): QueueItem[] {
  if (!isDocAction(task.action)) return [];
  const tpl = pickTemplate(firm.templates, task.action);
  if (!tpl) return [];

  const base = buildMergeContext(matter, firm.profile);
  const recipients: { kind: 'carrier' | 'provider'; name: string; address: string; ctx: Record<string, string> }[] =
    task.action === 'send_lor'
      ? matter.carriers.map((c: Carrier) => ({ kind: 'carrier', name: c.name, address: c.address, ctx: carrierContext(c) }))
      : matter.providers.map((p: Provider) => ({ kind: 'provider', name: p.name, address: p.address, ctx: providerContext(p) }));

  const autoRelease = routeTask(task) === 'execute';
  const created: QueueItem[] = [];

  for (const r of recipients) {
    const rendered = renderTemplate(tpl, { ...base, ...r.ctx });
    const incomplete = rendered.missingFields.length > 0;
    const item: QueueItem = {
      id: nextId(),
      matterId: matter.id,
      taskId: task.id,
      actionType: task.action,
      recipient: { kind: r.kind, name: r.name, address: r.address },
      subject: rendered.subject,
      renderedBody: rendered.body,
      missingFields: rendered.missingFields,
      status: incomplete ? 'incomplete' : 'ready',
      createdAt: new Date().toISOString(),
    };
    enqueue(item);
    // Auto-release only complete items; an incomplete auto task still waits.
    if (autoRelease && !incomplete) releaseItem(item.id, true);
    created.push(item);
  }

  return created;
}

// Convenience for the scaffold UI: run generation once per document action
// type, using a representative task from the catalog (so we get the expected
// fan-out — 2 LOR + 3 records + 3 bills against the seed matter).
export function generateForDocActions(tasks: FirmTask[], matter: Matter, firm: FirmContext): QueueItem[] {
  const out: QueueItem[] = [];
  for (const action of DOC_ACTIONS) {
    const task = tasks.find((t) => t.action === action);
    if (task) out.push(...generateDocuments(task, matter, firm));
  }
  return out;
}
