# 27. Zod validates at every trust boundary, and only there

File import, IndexedDB reads, URL params, share links and worker messages are parsed with Zod. Inside those boundaries the types are trusted and the simulation hot loop does no runtime validation.
