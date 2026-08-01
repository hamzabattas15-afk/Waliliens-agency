# Backend test suite

`npm test` runs fully mocked — no live Postgres or Redis required.

`tests/helpers/setup.ts` intercepts `src/db/prisma.js`, `src/config/redis.js`, and
`src/lib/queue.js` (plus the `ioredis`, `rate-limit-redis`, and `bullmq` packages
they wrap) with `vi.mock()`, backed by an in-memory store (`dbState` in that
file). No test needs a database connection, a Redis instance, or a running
BullMQ worker — everything the app touches through those modules resolves
in-process.

## If you add a `vi.mock()` for a project module

`vi.mock(specifier, factory)` resolves `specifier` **relative to the file
calling it** (`tests/helpers/setup.ts`, one level under `tests/`), not relative
to whichever file ends up importing the real module. To reach `src/db/prisma.ts`
from `tests/helpers/setup.ts` you need `../../src/db/prisma.js` — up out of
`helpers/`, up out of `tests/`, then into `src/`. Getting this wrong doesn't
error at collection time; it just silently fails to intercept, and the real
module (e.g. a real `PrismaClient`) gets constructed and hit instead, which
either hangs trying to reach a nonexistent database or throws deep inside
`@prisma/client`.

Verify a new mock actually applies by checking the test fails fast if you
misspell the path (an unmocked `PrismaClient` construction either times out
against `localhost:5432` or throws `PrismaClientInitializationError`) and
passes fast once corrected — a suite that used to hang/timeout suddenly
running in milliseconds is the tell that the mock is now intercepting.
