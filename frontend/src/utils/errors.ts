import { ApiError } from '../services/api';
import { hasKey, type Params, type TKey } from '../i18n';

type T = (key: TKey, params?: Params) => string;

/** Turn any thrown error into a sentence in the user's language. */
export function errorMessage(err: unknown, t: T): string {
  if (err instanceof ApiError) {
    if (err.code === 'validation_error') {
      const fields = (err.extra.fields as { field: string }[] | undefined) ?? [];
      const names = [...new Set(fields.map((f) => f.field.split('.').pop() || ''))]
        .map((f) => (hasKey(`field_${f}`) ? t(`field_${f}` as TKey) : f))
        .filter(Boolean);
      return names.length ? t('err_validation_fields', { fields: names.join(', ') }) : t('err_validation');
    }
    const key = `err_${err.code}`;
    if (hasKey(key)) {
      return t(key as TKey, err.extra as Params);
    }
    if (err.status === 0) return t('err_network');
    if (err.status >= 500) return t('err_server');
  }
  return t('err_generic');
}
