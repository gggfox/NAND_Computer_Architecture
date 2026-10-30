# 7. Offline-capable, installable PWA in v1

Circuits are stored on the device, and the owner uses phones and tablets, so the app works offline and is installable from the first version.

A new version waits instead of taking over, because taking over deletes the precache that open tabs still load lazy chunks from. The app shows a translated "update ready" prompt; accepting it activates the new worker, and every open tab writes pending edits and reloads once.
