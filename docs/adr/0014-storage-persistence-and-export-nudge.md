# 14. Request persistent storage and nudge export until cloud sync exists

The app calls `navigator.storage.persist()` and prompts the user to export when there is unexported work, because Safari may evict script-written storage after 7 days without interaction. Convex sync later removes the need.
