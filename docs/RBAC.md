# RBAC

| Capability               | Admin | Asset Manager | Department Head | Employee | Auditor |
| ------------------------ | :---: | :-----------: | :-------------: | :------: | :-----: |
| Organization and roles   |   ✓   |               |                 |          |         |
| Register/allocate assets |   ✓   |       ✓       |                 |          |         |
| Approve transfers        |   ✓   |       ✓       |     scoped      |          |         |
| Book resources           |   ✓   |       ✓       |     scoped      |   own    |         |
| Maintenance request      |   ✓   |       ✓       |     scoped      |   own    |         |
| Maintenance approval     |   ✓   |       ✓       |                 |          |         |
| Manage audits            |   ✓   |               |                 |          |         |
| Execute assigned audit   |       |               |                 |          |    ✓    |

Navigation is a convenience only. Routes, mutations, queries, and record scope must each enforce the same policy.
