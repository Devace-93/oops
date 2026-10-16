# Database

The canonical schema is defined in [`../dbcore/models.py`](../dbcore/models.py)
(SQLAlchemy). Plan limits and API-key roles come from
[`../packages/shared`](../packages/shared).

## First build
Tables are created by the `migrate` compose service:

```bash
python -m dbcore.cli upgrade   # create_all (idempotent) + alembic upgrade head
```

`migrations/versions/0001_initial.py` holds the full initial schema (accounts,
users, memberships, refresh tokens, subscriptions, projects, events, usage
counters, API keys, webhook events, audit events). It is written to be safe after
`create_all`: every `create_table` is skipped when the table already exists.

## Future migrations (Alembic)
Once the schema is live and you change `models.py`, generate a versioned
migration against a running database:

```bash
cd db
DATABASE_URL=postgresql+psycopg://oops:oops@localhost:5432/oops \
  alembic revision --autogenerate -m "describe change"
alembic upgrade head
```

`env.py` imports `dbcore.models` so autogenerate sees every table, and reads the
DB URL from `DATABASE_URL`. Write migrations idempotently (check the live schema
first): fresh installs get every table from `create_all` before they run.
