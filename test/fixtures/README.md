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

- **`workable-blueground.json`**, **`workable-epignosis.json`**, **`workable-persado.json`**
  (recorded 2026-10-21): `GET apply.workable.com/api/v1/widget/accounts/{board}?details=true`.
  3, 3 and 1 jobs covering remote/on-site, an empty employment type and a job listed once per
  city under the same shortcode. Company description cut too.
- **`smartrecruiters-canva.json`**, **`smartrecruiters-canva-details.json`** (2026-10-21):
  `GET api.smartrecruiters.com/v1/companies/Canva/postings?limit=100&locationType=REMOTE`
  cut to 4 postings, and `GET …/postings/{id}` for each of them, keyed by id. Custom fields
  trimmed to two.
- **`recruitee-thecodest.json`**, **`recruitee-curotec.json`**, **`recruitee-channable.json`**
  (2026-10-21): `GET {board}.recruitee.com/api/offers/`. 5, 3 and 3 offers covering remote
  offers open to one or many countries, hybrid and on-site, monthly and yearly salaries, a
  currency without amounts and a contract. Application questions, translations and mailbox
  addresses dropped.

All descriptions are cut to a short excerpt. Several sources restrict republishing
their listings (Remotive: don't submit jobs to third-party sites; Arbeitnow: personal,
non-commercial viewing only, no copying or mirroring), so only trimmed samples are
committed: enough to keep every field format and edge case real, without reproducing
full listings.
