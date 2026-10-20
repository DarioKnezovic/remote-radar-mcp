# Test fixtures

Responses recorded from the real APIs (2026-10-20) so tests never hit the network.

- **`remotive.json`**: `GET https://remotive.com/api/remote-jobs`. All 10 listings;
  descriptions cut to a short excerpt. Envelope (legal notice, counts) kept as-is.
- **`arbeitnow.json`**: `GET https://www.arbeitnow.com/api/job-board-api` (page 1).
  12 of 300 listings, picked to cover edge cases (remote flag missing, location in
  the title, German/French/Dutch job types). Descriptions cut to a short excerpt.
  Envelope (`links`, `meta`) kept as-is.

Both sources restrict republishing their listings (Remotive: don't submit jobs to
third-party sites; Arbeitnow: personal, non-commercial viewing only, no copying or
mirroring), so only trimmed samples are committed: enough to keep every field format
and edge case real, without reproducing full listings.
