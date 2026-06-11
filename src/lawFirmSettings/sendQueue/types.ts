// Send Queue — types (SCAFFOLD).

import type { TemplateActionType } from '../templates/types';

export type QueueStatus = 'draft' | 'incomplete' | 'ready' | 'released' | 'failed';

export interface QueueItem {
  id: string;
  matterId: string;
  taskId: string;
  actionType: TemplateActionType;
  recipient: { kind: 'carrier' | 'provider'; name: string; address?: string };
  subject?: string;
  renderedBody: string;   // final merged text
  missingFields: string[];
  status: QueueStatus;
  createdAt: string;
  releasedAt?: string;
  // Extension beyond the spec's QueueItem: marks items that auto-released
  // (route 'execute') so the Released tab can show an "auto" tag, per the UI spec.
  autoReleased?: boolean;
}

export interface QueueFilter {
  status?: QueueStatus;
  actionType?: TemplateActionType;
  matterId?: string;
}
