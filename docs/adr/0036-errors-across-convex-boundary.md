# 36. Errors across the Convex boundary: Result inside, ConvexError on the wire

Convex rolls back a mutation's writes only when the function throws ("throwing an error will prevent the mutation transaction from committing"); returning an error value completes normally. In production, any thrown error other than `ConvexError` is redacted to "Server Error", while `ConvexError.data` reaches the client intact. Sources: https://docs.convex.dev/functions/error-handling/application-errors, https://docs.convex.dev/functions/error-handling/

Decision (refines ADR 28):
- Domain code (`simulation/**`, `features/*/domain/**`) returns `Result<T, E>`; `throw` is banned there.
- Convex functions (`convex/**`) call domain code and, on `{ ok: false, error }`, `throw new ConvexError(error)`. Throwing anything other than `ConvexError` with a typed payload is banned in `convex/**`. Mutations must never return an error value after writing.
- Client adapters (`features/*/adapters/**`) catch `ConvexError`, parse `error.data` with Zod against the same error union, and return `Result<T, E>` to the UI. Convex query errors surface through an error boundary and are mapped the same way.
- Adapters may catch library exceptions (IndexedDB, browser APIs) and convert them to `Result`. Elsewhere `throw` is reserved for unreachable/bug cases.

Error unions are plain serialisable objects (`{ type: "ChipInUse", chipId }`) so the same type crosses the network unchanged.
