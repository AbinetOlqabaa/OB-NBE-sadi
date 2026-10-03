# Phase 32 --- Dynamic NBE API Endpoint Registry & Simulator Integration

## Execution prompt

Extend the imported report-definition architecture so every newly
created NBE report can carry a governed NBE API integration definition
and appear dynamically in the existing NBE Simulator.

### Context

The platform already has `nbeAdapter` and `nbeSimulator`. The goal is
not to create a second integration layer. Make the endpoint
configuration metadata-driven and connected to the imported report
definition.

### Required implementation

1.  Add a governed integration configuration to each report
    definition/version:
    -   endpoint URL or simulator route;
    -   HTTP method;
    -   request content type;
    -   expected response type;
    -   timeout;
    -   NBE report/return identifier;
    -   idempotency strategy;
    -   authentication/mTLS profile reference;
    -   request/response mapping;
    -   simulator scenario metadata.
2.  If the NBE JSON includes an endpoint, import it through the Phase 31
    normalizer.
3.  If the JSON does not include an endpoint, allow an Admin to enter
    the endpoint through a dedicated field in the Admin
    report-definition workflow.
4.  Never expose secrets, private keys, client certificates or
    authentication credentials in the JSON import or frontend.
5.  Store only references to managed authentication profiles.
6.  Validate endpoint syntax, allowed protocol, environment and host
    policy.
7.  Prevent arbitrary client-side/server-side proxying to unapproved
    destinations.
8.  Integrate endpoint selection into the existing `nbeAdapter`.
9.  Add dynamic simulator registration:
    -   new report appears without hardcoded source-code changes;
    -   simulator lists report key/title/version/status;
    -   simulator can build the correct payload from the active
        template;
    -   simulator can route the payload to the configured simulated
        endpoint;
    -   response and receipt are displayed using existing simulator
        patterns.
10. Preserve idempotency keys and existing mTLS behavior.
11. Clearly distinguish:

-   LOCAL/SIMULATOR;
-   TEST/NBE TEST;
-   PRODUCTION/NBE.

12. Production transmission must remain disabled unless the environment
    and credentials explicitly permit it.
13. Keep the Admin-only visibility rule for the simulator.

### Tests

Cover:

-   endpoint imported from JSON;
-   endpoint manually entered by Admin;
-   endpoint validation;
-   unauthorized endpoint rejected;
-   secret material never returned to frontend;
-   dynamic simulator discovery of a newly imported report;
-   payload generation;
-   simulator response parsing;
-   idempotency;
-   version-specific payload construction;
-   retired report removed from active simulator choices;
-   Admin-only simulator access;
-   Maker/Checker/Auditor access rejected.

### Acceptance criteria

A newly imported and published report automatically becomes available in
the NBE Simulator according to its active version and endpoint
configuration, without adding hardcoded simulator code for that report.

The simulator must use the same metadata and NBE adapter path used by
actual submission integration, so simulator behavior is not a separate
fake implementation.
