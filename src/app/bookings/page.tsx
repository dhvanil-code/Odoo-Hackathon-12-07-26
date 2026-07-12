import type { Prisma } from "@prisma/client";
import Link from "next/link";
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { requireActor, isOrganizationWide } from "@/auth/access";
import { ActionForm } from "@/components/action-form";
import { Shell } from "@/components/shell";
import { PageHead, Badge } from "@/components/ui";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export default async function Bookings({
  searchParams,
}: {
  searchParams: Promise<{ view?: "day" | "week" | "month" }>;
}) {
  const actor = await requireActor("bookings:manage");
  const now = new Date();
  const { view = "week" } = await searchParams;
  const rangeStart =
    view === "day"
      ? startOfDay(now)
      : view === "month"
        ? startOfMonth(now)
        : startOfWeek(now);
  const rangeEnd =
    view === "day"
      ? endOfDay(now)
      : view === "month"
        ? endOfMonth(now)
        : endOfWeek(now);
  const scope: Prisma.ResourceBookingWhereInput = isOrganizationWide(actor)
    ? {}
    : actor.roles.includes("DEPARTMENT_HEAD")
      ? { departmentId: actor.departmentId }
      : { bookedById: actor.employeeId };
  const [resources, bookings] = await Promise.all([
    db.asset.findMany({
      where: {
        shared: true,
        status: { notIn: ["UNDER_MAINTENANCE", "LOST", "RETIRED", "DISPOSED"] },
      },
      orderBy: { name: "asc" },
    }),
    db.resourceBooking.findMany({
      where: {
        ...scope,
        startTime: { lt: rangeEnd },
        endTime: { gt: rangeStart },
      },
      include: { resource: true, bookedBy: true, department: true },
      orderBy: { startTime: "asc" },
      take: 100,
    }),
  ]);
  return (
    <Shell active="Resource booking">
      <div className="page">
        <PageHead
          eyebrow="Shared resources"
          title="Booking calendar"
          description="PostgreSQL enforces conflict-free half-open intervals: [start, end)."
          action={
            <ActionForm
              label="+ Book a resource"
              title="Book shared resource"
              endpoint="/api/workflows/book"
              fields={[
                {
                  name: "resourceId",
                  label: "Resource",
                  type: "select",
                  required: true,
                  options: resources.map((resource) => ({
                    value: resource.id,
                    label: `${resource.tag} · ${resource.name}`,
                  })),
                },
                {
                  name: "startTime",
                  label: "Start",
                  type: "datetime-local",
                  required: true,
                },
                {
                  name: "endTime",
                  label: "End",
                  type: "datetime-local",
                  required: true,
                },
                {
                  name: "purpose",
                  label: "Purpose",
                  type: "textarea",
                  required: true,
                },
                {
                  name: "attendeeCount",
                  label: "Attendee/passenger count",
                  type: "number",
                },
              ]}
            />
          }
        />
        <div className="tabs">
          {(["day", "week", "month"] as const).map((item) => (
            <Link
              key={item}
              className={`tab ${view === item ? "active" : ""}`}
              href={`/bookings?view=${item}`}
            >
              {item[0].toUpperCase() + item.slice(1)}
            </Link>
          ))}
        </div>
        <div className="grid-2">
          <div className="card">
            <b>Upcoming schedule</b>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Resource</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Booked by</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((booking) => (
                    <tr key={booking.id}>
                      <td>{booking.resource.name}</td>
                      <td>{booking.startTime.toLocaleString()}</td>
                      <td>{booking.endTime.toLocaleString()}</td>
                      <td>{booking.bookedBy.name}</td>
                      <td>
                        <Badge
                          tone={
                            booking.status === "CANCELLED"
                              ? "red"
                              : booking.status === "ONGOING"
                                ? "amber"
                                : ""
                          }
                        >
                          {booking.status}
                        </Badge>
                      </td>
                      <td>
                        {booking.status === "UPCOMING" && (
                          <div className="toolbar">
                            <ActionForm
                              label="Reschedule"
                              title={`Reschedule ${booking.resource.name}`}
                              endpoint="/api/workflows/reschedule-booking"
                              tone="secondary"
                              fields={[
                                {
                                  name: "id",
                                  label: "Booking ID",
                                  defaultValue: booking.id,
                                  required: true,
                                },
                                {
                                  name: "startTime",
                                  label: "New start",
                                  type: "datetime-local",
                                  required: true,
                                },
                                {
                                  name: "endTime",
                                  label: "New end",
                                  type: "datetime-local",
                                  required: true,
                                },
                              ]}
                            />
                            <ActionForm
                              label="Cancel"
                              title={`Cancel ${booking.resource.name}`}
                              endpoint="/api/workflows/cancel-booking"
                              tone="secondary"
                              fields={[
                                {
                                  name: "id",
                                  label: "Booking ID",
                                  defaultValue: booking.id,
                                  required: true,
                                },
                              ]}
                            />
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {bookings.length === 0 && (
              <p className="subtle">No bookings in your scope.</p>
            )}
          </div>
          <div className="card">
            <b>Resource availability</b>
            <p className="subtle">Current lifecycle state</p>
            {resources.map((resource) => {
              const next = bookings.find(
                (booking) =>
                  booking.resourceId === resource.id &&
                  booking.status !== "CANCELLED" &&
                  booking.endTime > now,
              );
              return (
                <div
                  key={resource.id}
                  style={{
                    padding: "16px 0",
                    borderBottom: "1px solid #edf0ed",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <b>{resource.name}</b>
                  <Badge tone={next ? "amber" : ""}>
                    {next
                      ? `Next: ${next.startTime.toLocaleString()}`
                      : "Available"}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Shell>
  );
}
