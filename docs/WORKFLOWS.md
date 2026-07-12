# Workflows

Allocation revalidates availability inside a serializable transaction. Transfer is Requested → Approved/Rejected → Completed; approval retains the holder, while completion creates a new allocation. Returns are Requested → Inspection → Accepted and may route damaged items to maintenance. Maintenance is Pending → Approved → Technician Assigned → In Progress → Resolved. Audits are Draft → Scheduled → In Progress → Review → Closed; closed lines are immutable and missing/damaged results create discrepancies.
