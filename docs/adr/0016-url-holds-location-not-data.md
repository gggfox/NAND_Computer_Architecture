# 16. The URL holds location; storage holds data

Route and search params hold where the user is (project, chip being edited, possibly viewport), so refresh and back/forward work on mobile. Circuit data lives in IndexedDB. Only share links carry data, compressed in the URL fragment.
