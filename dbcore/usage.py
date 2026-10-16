"""Monthly usage metering.

One metered metric per account per calendar month: ``events``, the number of
hits received by the collect API (page views + custom events). The plan limit
``events_per_month`` is a SOFT-DROP limit: the collect endpoints keep answering
202 past it so a tracked site never sees an error, but hits over the budget
are counted and NOT stored. The overage shows up in the dashboard and a single
PostHog ``limit_reached {which: "events"}`` event fires per period
(``events_limit_notified`` makes it one-shot).

Period = calendar month [first day, first day of next month).
"""
from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .models import UsageCounter
from .plans import is_unlimited


def _today() -> date:
    return datetime.now(timezone.utc).date()


def period_bounds(on: date | None = None) -> tuple[date, date]:
    on = on or _today()
    start = on.replace(day=1)
    if start.month == 12:
        end = start.replace(year=start.year + 1, month=1)
    else:
        end = start.replace(month=start.month + 1)
    return start, end


def get_or_create_counter(session: Session, account_id, on: date | None = None) -> UsageCounter:
    start, end = period_bounds(on)
    stmt = select(UsageCounter).where(
        UsageCounter.account_id == account_id,
        UsageCounter.period_start == start,
    )
    counter = session.scalar(stmt)
    if counter is None:
        # Two workers may race on the first request of a month; the unique
        # constraint settles it and the loser simply re-reads the winner's row.
        try:
            with session.begin_nested():
                counter = UsageCounter(
                    account_id=account_id, period_start=start, period_end=end,
                    events=0, events_limit_notified=False,
                )
                session.add(counter)
                session.flush()
        except IntegrityError:
            counter = session.scalar(stmt)
    return counter


def meter_event(session: Session, account_id, limit: int) -> tuple[bool, bool]:
    """Count one hit. Returns ``(store, notify)``:

    * ``store`` — False when the hit is over the plan budget and must be dropped;
    * ``notify`` — True exactly once per period, the first time the counter
      reaches ``limit`` (the caller fires the PostHog event).
    """
    counter = get_or_create_counter(session, account_id)
    # Atomic SQL increment: collect traffic is concurrent by nature and a
    # read-modify-write in Python would lose counts across workers.
    total = session.scalar(
        update(UsageCounter)
        .where(UsageCounter.id == counter.id)
        .values(events=UsageCounter.events + 1)
        .returning(UsageCounter.events)
    )
    if is_unlimited(limit) or total <= limit:
        return True, False
    # Only the request that flips the flag gets to notify (one-shot).
    flipped = session.scalar(
        update(UsageCounter)
        .where(UsageCounter.id == counter.id, UsageCounter.events_limit_notified.is_(False))
        .values(events_limit_notified=True)
        .returning(UsageCounter.id)
    )
    return False, flipped is not None
