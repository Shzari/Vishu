# Vishu Web App Engineering Playbook

This file is the practical engineering standard for `Vishu.shop`.

It is written from the point of view of a senior software engineer who has seen projects succeed, stall, overcomplicate themselves, and fail in production.

The goal is not to sound clever.
The goal is to build a web app that is:

- understandable
- secure
- testable
- operable
- fast enough
- easy to extend
- hard to accidentally break

## The Core Way Of Thinking

The best web app is not the one with the fanciest stack.
It is the one that keeps working when traffic grows, when product changes, when a teammate joins, and when something goes wrong at 2 AM.

That means:

- choose boring, proven building blocks first
- keep the number of moving parts low
- make the database the source of truth for business state
- make every important flow observable and testable
- make security the default, not an afterthought
- optimize for maintainability before micro-optimization

## What A Senior Engineer Optimizes For

### 1. Clear business rules

Before writing code, define:

- who can do the action
- what state is allowed
- what data is the source of truth
- what must happen on success
- what must happen on failure

If the rule is not clear, the code will become inconsistent.

### 2. Stable system boundaries

Every serious web app should have clean boundaries:

- UI concerns stay in the frontend
- business rules stay in the API
- durable state stays in the database
- secrets stay out of the browser
- operational infrastructure is explicit

### 3. Explicit state transitions

Most bugs happen in transitions, not in static pages.

For Vishu, examples are:

- guest -> customer account
- vendor registered -> verified -> approved -> active
- order pending -> confirmed -> shipped -> delivered
- product hidden -> public
- unauthenticated -> authenticated

A senior engineer treats these transitions as first-class design problems.

### 4. Security by default

The secure thing should be the normal thing.

Examples:

- use `HttpOnly` cookies instead of browser-stored bearer tokens
- hash recovery tokens at rest
- validate upload content, not just file names
- rate-limit public auth endpoints
- reject weak secrets at startup
- validate redirect and link targets

### 5. Operational simplicity

A good app is easy to run, not just easy to demo.

You should always know:

- how to start it
- how to build it
- how to seed it
- how to verify it is healthy
- how to deploy it
- how to know what broke

## The Best Practical Shape Of A Web App

For most product web apps, the best shape is:

1. A frontend that renders the product cleanly and keeps client state minimal.
2. An API that owns business rules and authorization.
3. A relational database that owns durable business state.
4. A thin reverse proxy that handles HTTPS, headers, and routing.
5. A small number of background or operational scripts for bootstrap, indexing, seeding, and repair.

That is already the right broad direction for Vishu.

## The Right Architecture For Vishu

Current stack:

- `apps/web`: Next.js
- `apps/api`: NestJS
- SQL Server for business data
- Caddy as the reverse proxy

This is a good MVP-to-production shape if we keep it disciplined.

### Recommended architectural rules for Vishu

- Keep marketplace business logic in the API, not duplicated across pages.
- Keep SQL Server as the source of truth for all meaningful workflow state.
- Keep browser storage limited to low-risk convenience state like a guest cart.
- Keep authentication server-driven.
- Keep admin actions auditable.
- Keep vendor visibility rules centralized and consistent.
- Keep product and catalog structure normalized in the database.

## How To Decide What To Build

Before implementing a feature, answer these questions:

1. What user or operator pain does this solve?
2. What is the smallest useful version?
3. What data model change is required?
4. What are the states and transitions?
5. What are the permissions?
6. What can go wrong?
7. How will we test it?
8. How will we observe it in production?

If these are not answered, do not jump into UI work yet.

## The Senior Feature Process

For every feature:

1. Define the business rule.
2. Define the source of truth.
3. Design the API shape.
4. Design the database shape.
5. Handle permissions and failure cases.
6. Build the backend first if the workflow is stateful.
7. Build the frontend against stable API contracts.
8. Add tests for the key transitions.
9. Add logging or audit entries where the action matters operationally.
10. Update docs if the workflow or data model changed.

## Frontend Principles

### Keep the frontend honest

The frontend should be a good client, not a shadow backend.

It can:

- present data
- collect input
- manage local UI state
- optimistically improve experience when safe

It should not:

- be the source of truth for permissions
- be the source of truth for business state
- store secrets
- silently invent backend rules

### Design rules

- prefer simple navigation and clear user paths over visual noise
- make empty states useful
- make loading and error states explicit
- keep forms close to the business action they represent
- avoid mixing too many jobs into one page

### State rules

- durable business state belongs in SQL
- auth session belongs in secure cookies
- low-risk convenience state can stay local
- derived state should not be duplicated when it can be recomputed

## Backend Principles

### The API must own the rules

If the system has to be correct, the API must enforce:

- identity
- authorization
- validation
- workflow transitions
- data integrity

### Backend style rules

- keep controllers thin
- keep services focused on business logic
- centralize repeated security and workflow logic
- validate input aggressively
- fail clearly
- keep writes transactional when multiple tables must stay consistent

### Good backend questions

- Can this endpoint be abused?
- Can a user perform this action twice?
- Can two actions race?
- Can a partial write leave inconsistent state?
- Is this state transition reversible, and should it be?

## Database Principles

### The database is a product asset

Treat the schema as core product design, not plumbing.

Good schema design means:

- stable identifiers
- normalized relationships where business meaning matters
- explicit timestamps
- clear status fields
- careful uniqueness constraints
- indexes on the paths the app actually uses

### SQL rules for Vishu

- keep important workflow state in SQL
- prefer explicit relation tables over loosely structured text fields
- keep compatibility fields only where necessary
- add migrations/bootstrap logic carefully and document them

## Security Principles

Security is not one feature.
It is the default posture of the system.

### Minimum serious web app posture

- secure session handling
- strict input validation
- rate limiting on public auth and recovery flows
- hashed recovery tokens
- strong secret handling
- safe upload validation
- safe link and redirect validation
- secure response headers
- least privilege for admin actions
- auditability for high-impact actions

### For Vishu specifically

Always protect:

- admin powers
- vendor activation and shop access
- customer account recovery
- order ownership
- uploaded media handling
- email and payment configuration

### Security rule of thumb

If a bad actor can turn one mistake into many accounts, many emails, many resets, or many state changes, add a guardrail.

## Testing Principles

The best tests are not the most tests.
They are the tests that protect the risky transitions.

### Priorities

1. Authentication and authorization
2. Checkout and order creation
3. Account recovery and activation
4. Vendor approval and visibility
5. Product create/update/delete flows
6. Admin high-impact actions

### Test layers

- unit tests for pure rules
- integration tests for service behavior
- e2e tests for business-critical flows

### Test what matters most

For every major feature, prove:

- allowed user succeeds
- wrong user is rejected
- invalid state is rejected
- durable state changes correctly
- side effects happen exactly once when they should

## Performance Principles

Premature performance work wastes time.
Late performance work under pressure is worse.

The right approach:

- avoid obviously expensive queries
- index hot paths
- paginate large listings
- keep payloads intentional
- measure before tuning

For Vishu, correctness and clarity matter more than shaving tiny milliseconds off admin pages.

## Operational Principles

Production quality means the system is understandable in motion.

You should be able to answer:

- who did this
- when did it happen
- what state changed
- what email was sent
- why the system rejected an action

### Operational basics

- health checks
- build reproducibility
- stable local startup
- seed data for demos and QA
- activity logs for admin actions
- deployment checklists

## Code Review Standard

When reviewing code, ask:

1. Is the business rule clear?
2. Is the source of truth clear?
3. Is the state transition safe?
4. Is auth enforced in the backend?
5. Is the failure path acceptable?
6. Is this simpler than it was before?
7. Will the next engineer understand it quickly?

If the answer to the last question is no, the design is not finished.

## Things To Avoid

- hiding important business logic in UI code
- storing sensitive auth state in browser storage
- adding tables or columns without updating docs
- duplicating workflow rules across controllers and components
- mixing demo shortcuts into production rules
- inventing abstractions before repetition proves the need
- using “temporary” hacks for core auth, checkout, or admin flows

## The Best Way To Build A Web App

If reduced to one page, the best way is:

1. Start with business rules.
2. Make state explicit.
3. Put durable truth in the database.
4. Put enforcement in the backend.
5. Keep the frontend simple and honest.
6. Use secure defaults.
7. Prefer boring technology over clever technology.
8. Test the risky transitions.
9. Log important actions.
10. Keep docs current enough that another engineer can continue without guessing.

## What This Means For Vishu Right Now

The next strong engineering priorities for Vishu are:

1. Keep moving important state and trust decisions server-side.
2. Move platform secrets out of general DB storage into environment or managed secret storage.
3. Continue tightening admin and vendor operational workflows.
4. Preserve normalized catalog and workflow integrity as features grow.
5. Upgrade the remaining flagged runtime dependencies carefully, with compatibility checks.

## Final Rule

Do not try to impress the codebase.
Make the codebase dependable.

That is how good web apps are built.
