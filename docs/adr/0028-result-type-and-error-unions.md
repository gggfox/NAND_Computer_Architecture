# 28. Fallible operations return Result with discriminated error unions

Expected failures return `{ ok: true, value } | { ok: false, error }`. Each feature defines its errors as a discriminated union (e.g. `{ type: "UnsupportedVersion", version }`), which the UI must handle exhaustively and which maps to an i18n message. `throw` is reserved for bugs and banned in domain/engine code by lint.
