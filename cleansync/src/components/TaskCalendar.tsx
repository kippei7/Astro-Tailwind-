import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  eventsByDate,
  monthGrid,
  shiftYearMonth,
  tasksHref,
  WEEKDAYS,
} from "@/lib/calendar";
import { monthKey } from "@/lib/dates";
import type { TaskEventView } from "@/lib/types";

const MAX_LABELS = 3;

export function TaskCalendar({
  year,
  month,
  today,
  selectedDate,
  events,
  status,
}: {
  year: number;
  month: number;
  today: string;
  selectedDate: string;
  events: TaskEventView[];
  status: string;
}) {
  const cells = monthGrid(year, month, today);
  const grouped = eventsByDate(events);
  const prev = shiftYearMonth(year, month, -1);
  const next = shiftYearMonth(year, month, 1);

  return (
    <section className="cal-wrap">
      <div className="cal-toolbar">
        <Link
          href={tasksHref({ month: monthKey(prev.year, prev.month), status })}
          className="cal-nav-btn"
          aria-label="前の月"
        >
          <ChevronLeft size={18} />
        </Link>
        <h2 className="cal-month-label">
          {year}年{month}月
        </h2>
        <Link
          href={tasksHref({ month: monthKey(next.year, next.month), status })}
          className="cal-nav-btn"
          aria-label="次の月"
        >
          <ChevronRight size={18} />
        </Link>
        <Link
          href={tasksHref({ month: today.slice(0, 7), date: today, status })}
          className="btn-secondary cal-today-btn"
        >
          今日
        </Link>
      </div>

      <div className="cal-weekdays">
        {WEEKDAYS.map((label, index) => (
          <div
            key={label}
            className={
              index === 0
                ? "cal-weekday cal-weekday-sun"
                : index === 6
                  ? "cal-weekday cal-weekday-sat"
                  : "cal-weekday"
            }
          >
            {label}
          </div>
        ))}
      </div>

      <div className="cal-grid">
        {cells.map((cell) => {
          const dayEvents = grouped.get(cell.date) ?? [];
          const selected = cell.date === selectedDate;
          const labels = dayEvents.slice(0, MAX_LABELS);
          const overflow = dayEvents.length - labels.length;
          const cellMonth = cell.date.slice(0, 7);
          const selectHref = tasksHref({
            month: cellMonth,
            date: cell.date,
            status,
          });

          return (
            <div
              key={cell.date}
              className={[
                "cal-cell",
                cell.inMonth ? "" : "cal-cell-out",
                cell.isToday ? "cal-cell-today" : "",
                selected ? "cal-cell-selected" : "",
                dayEvents.some((event) => event.status === "TODO" && event.isAlert)
                  ? "cal-cell-alert"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="cal-cell-head">
                <Link
                  href={selectHref}
                  className={
                    cell.weekday === 0
                      ? "cal-daynum cal-daynum-sun"
                      : cell.weekday === 6
                        ? "cal-daynum cal-daynum-sat"
                        : "cal-daynum"
                  }
                >
                  {cell.day}
                </Link>
                <Link href={`${selectHref}#day-panel`} className="cal-add" aria-label={`${cell.date}に予定を追加`}>
                  +
                </Link>
              </div>
              <Link href={selectHref} className="cal-cell-body" tabIndex={-1}>
                <span className="sr-only">{cell.date}の予定を見る</span>
              </Link>
              <div className="cal-dots" aria-hidden>
                {dayEvents.slice(0, 4).map((event) => (
                  <span
                    key={event.id}
                    className={
                      event.status === "DONE"
                        ? "cal-dot cal-dot-done"
                        : event.isAlert && event.status === "TODO"
                          ? "cal-dot cal-dot-alert"
                          : "cal-dot"
                    }
                    style={{ background: event.assignee.color }}
                  />
                ))}
              </div>
              <div className="cal-chips">
                {labels.map((event) => (
                  <Link
                    key={event.id}
                    href={`/tasks/${event.id}`}
                    className={[
                      "cal-chip",
                      event.status === "DONE" ? "cal-chip-done" : "",
                      event.status === "CANCELLED" ? "cal-chip-cancel" : "",
                      event.isAlert && event.status === "TODO" ? "cal-chip-alert" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={{ ["--chip" as string]: event.assignee.color }}
                    title={`${event.area.name} / ${event.master.name}（${event.assignee.name}）`}
                  >
                    <span className="cal-chip-dot" />
                    <span className="cal-chip-name">{event.master.name}</span>
                  </Link>
                ))}
                {overflow > 0 ? (
                  <Link href={selectHref} className="cal-more">
                    +{overflow}
                  </Link>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
