import { Activity, Boxes, LucideIcon, Package, ReceiptText, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { AuditEntry } from "../api/client";
import { EmptyState, Segmented, Skeleton } from "../components/ui/primitives";
import { useAuditLog } from "../hooks/queries";
import { PageHeader, QueryError } from "../layout/PageHeader";
import { displayName, formatDate } from "../lib/format";

type Filter = "all" | "order" | "product" | "inventory" | "member";

const ICONS: Record<string, LucideIcon> = {
  order: ReceiptText,
  product: Package,
  inventory: Boxes,
  member: Users,
};

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) {
    return "Today";
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }
  return formatDate(iso, { weekday: "long", month: "long", day: "numeric" });
}

function groupByDay(entries: AuditEntry[]): Array<[string, AuditEntry[]]> {
  const groups = new Map<string, AuditEntry[]>();
  for (const entry of entries) {
    const label = dayLabel(entry.created_at);
    groups.set(label, [...(groups.get(label) ?? []), entry]);
  }
  return [...groups.entries()];
}

export default function ActivityPage() {
  const log = useAuditLog();
  const [filter, setFilter] = useState<Filter>("all");

  const entries = useMemo(
    () => (log.data ?? []).filter((entry) => filter === "all" || entry.resource_type === filter),
    [log.data, filter],
  );
  const groups = useMemo(() => groupByDay(entries), [entries]);

  return (
    <>
      <PageHeader
        title="Activity"
        description="An audit trail of every change in this workspace, written in the same transaction as the change itself."
        actions={
          <Segmented
            label="Filter activity"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All" },
              { value: "order", label: "Orders" },
              { value: "product", label: "Catalog" },
              { value: "inventory", label: "Stock" },
              { value: "member", label: "Team" },
            ]}
          />
        }
      />

      {log.isError ? (
        <QueryError error={log.error} onRetry={() => void log.refetch()} />
      ) : (
        <section className="card">
          {log.isPending ? (
            <div className="skeleton-stack" style={{ padding: "1.25rem" }}>
              {Array.from({ length: 8 }, (_, index) => (
                <Skeleton key={index} height={36} />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <EmptyState
              icon={<Activity />}
              title="Nothing here yet"
              description="Changes to orders, products, stock and the team will be recorded here."
            />
          ) : (
            <div className="activity">
              {groups.map(([day, items]) => (
                <section key={day}>
                  <h2 className="activity-day">{day}</h2>
                  <ol>
                    {items.map((entry) => {
                      const Icon = ICONS[entry.resource_type] ?? Activity;
                      return (
                        <li key={entry.id}>
                          <span className="activity-icon">
                            <Icon aria-hidden />
                          </span>
                          <div className="activity-text">
                            <p>{entry.summary}</p>
                            <span className="muted">
                              {entry.actor_email ? displayName(entry.actor_name, entry.actor_email) : "System"}
                            </span>
                          </div>
                          <time className="muted num" dateTime={entry.created_at}>
                            {new Date(entry.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          </time>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              ))}
            </div>
          )}
          {log.data && log.data.length >= 150 && <div className="table-footer">Showing the latest 150 events</div>}
        </section>
      )}
    </>
  );
}
