# Test fixtures

Responses recorded from the real APIs (2026-10-20) so tests never hit the network.

- **`remotive.json`**: `GET https://remotive.com/api/remote-jobs`. All 10 listings;
  descriptions cut to a short excerpt. Envelope (legal notice, counts) kept as-is.
- **`arbeitnow.json`**: `GET https://www.arbeitnow.com/api/job-board-api` (page 1).
  17 of 300 listings, picked to cover edge cases (remote flag missing, location in
  the title, German/French/Dutch job types, real duplicate postings and a near-miss).
  Descriptions cut to a short excerpt. Envelope (`links`, `meta`) kept as-is.
- **`remoteok.json`**: `GET https://remoteok.com/api`. The legal notice plus 8 of 99
  listings (salary given or 0, empty / "Remote" / "Remote - US" / country / city
  locations).
- **`greenhouse-gitlab.json`**, **`greenhouse-canonical.json`**:
  `GET boards-api.greenhouse.io/v1/boards/{gitlab,canonical}/jobs?content=true`.
  6 and 3 listings covering multi-country remote, on-site, plain "Remote" and
  Canonical's "Home based" wording. `content` stays entity-escaped, as the API sends it.
- **`lever-spotify.json`**, **`lever-offchainlabs.json`**:
  `GET api.lever.co/v0/postings/{spotify,offchainlabs}?mode=json`. 6 and 2 postings
  covering hybrid/remote/onsite, "Full Time Contractor", "Short Term" and a salary range.
  Lists trimmed to two items.
- **`ashby-linear.json`**, **`ashby-posthog.json`**:
  `GET api.ashbyhq.com/posting-api/job-board/{linear,posthog}?includeCompensation=true`.
  4 jobs each covering regions, secondary locations, hybrid/on-site and region-valued
  addresses.

All descriptions are cut to a short excerpt. Several sources restrict republishing
their listings (Remotive: don't submit jobs to third-party sites; Arbeitnow: personal,
non-commercial viewing only, no copying or mirroring), so only trimmed samples are
committed: enough to keep every field format and edge case real, without reproducing
full listings.
