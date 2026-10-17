import type { TKey } from '../i18n';
import type { SessionKind } from '../types';

export const KIND_META: Record<SessionKind, { icon: string; key: TKey }> = {
  keynote: { icon: 'star', key: 'kind_keynote' },
  talk: { icon: 'microphone', key: 'kind_talk' },
  workshop: { icon: 'screwdriver-wrench', key: 'kind_workshop' },
  panel: { icon: 'people-group', key: 'kind_panel' },
  break: { icon: 'mug-hot', key: 'kind_break' },
};
