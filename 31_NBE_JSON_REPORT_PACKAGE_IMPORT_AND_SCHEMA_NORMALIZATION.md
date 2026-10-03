# Phase 31 --- NBE JSON Report Package Import & Schema Normalization

## Execution prompt

Implement a production-quality Administrator workflow for importing an
NBE-provided JSON report-definition package and turning it into a
governed OB report-definition draft.

### Context

The existing platform already has a metadata-driven report-definition
engine, configurable sections/fields/schedule columns/formulas,
immutable template versioning, validation, preview, publishing and
department linkage. Do not replace that architecture. Extend it so an
NBE JSON package becomes a first-class source of a new report
definition.

The NBE package is expected to contain non-changing report structure
such as:

-   report type/return key;
-   main title;
-   subtitles;
-   section/topic/row titles;
-   column titles;
-   field/item codes;
-   data types;
-   required/optional semantics;
-   formulas and dependencies where supplied;
-   reporting frequency;
-   regulatory category;
-   NBE mapping information;
-   API endpoint information or an endpoint reference;
-   other schema metadata defined by NBE.

The old 24 report JSON files may contain sample/example values. Those
values must not be treated as authoritative business data for the new
template model.

### Required implementation

1.  Add an Administrator-only "Import NBE Report JSON" workflow.
2.  Accept a JSON file through the Admin dashboard.
3.  Parse and validate the JSON before changing any persistent
    configuration.
4.  Produce a detailed import-validation result:
    -   valid;
    -   invalid JSON;
    -   unsupported schema version;
    -   missing required metadata;
    -   duplicate report key;
    -   duplicate field/column code;
    -   invalid formula dependency;
    -   circular dependency;
    -   invalid data type;
    -   invalid endpoint declaration;
    -   unsupported property.
5.  Normalize the imported package into the existing report-definition
    model rather than creating a second report-schema system.
6.  Strip sample/business values from the imported template unless the
    value is explicitly declared by the NBE schema as a structural
    default.
7.  Preserve non-changing labels and titles as report-definition
    metadata.
8.  Create the imported report as a DRAFT configuration/version.
9.  Show an import preview before publication.
10. Do not automatically publish an imported report.
11. Record the source package hash, import timestamp, importing Admin,
    schema/package version and normalized-definition hash.
12. Preserve the original imported package as an auditable source
    artifact or canonical stored representation.
13. Reject unsafe or ambiguous JSON structures instead of silently
    guessing.
14. Integrate with the existing configuration governance lifecycle and
    4-eyes approval rules.

### JSON contract requirements

Define and document a versioned import envelope. It should support an
explicit structure similar to:

``` json
{
  "packageVersion": "1.0",
  "report": {
    "returnKey": "",
    "shortCode": "",
    "mainTitle": "",
    "subTitles": [],
    "description": "",
    "frequency": "",
    "regulatoryCategory": "",
    "sections": [],
    "fields": [],
    "columns": [],
    "formulas": [],
    "validationRules": [],
    "nbeMapping": {}
  },
  "integration": {
    "apiEndpoint": "",
    "httpMethod": "POST",
    "contentType": "application/json",
    "authenticationProfile": "",
    "timeoutMs": 30000
  }
}
```

Treat this as a conceptual contract, not a license to override the
actual NBE schema if an authoritative package format is supplied by NBE.
Implement an adapter/normalizer so future NBE schema versions can be
supported without rewriting the report engine.

### Sample-value handling

When importing the legacy 24 report definitions:

-   identify sample values versus structural metadata;
-   migrate titles, codes, sections, columns, formulas and rules;
-   do not migrate example financial/accounting values into new report
    templates;
-   use explicit schema defaults only where their semantics are
    documented;
-   retain source examples only in a clearly labeled
    development/reference context if they are still needed.

### Security and governance

-   Admin role required for import.
-   Server-side authorization is mandatory.
-   File size and JSON depth/complexity limits must be enforced.
-   Reject prototype-pollution-style keys and unsafe object structures.
-   Never execute formulas or code from imported JSON.
-   Imported formulas must pass the existing AST/parser and dependency
    checks.
-   Endpoint URLs must be validated and must not permit arbitrary
    server-side proxying.
-   Audit import, validation failure, draft creation, publication and
    rollback events.

### Tests

Add a dedicated suite covering at least:

1.  valid package import;
2.  malformed JSON;
3.  unsupported schema version;
4.  missing title/report key;
5.  duplicate field codes;
6.  duplicate column keys;
7.  circular formulas;
8.  sample-value stripping;
9.  structural/default-value preservation;
10. imported draft not automatically published;
11. Admin-only authorization;
12. audit/source hash creation;
13. package re-import/idempotency behavior;
14. backward compatibility with the existing 24 report definitions.

### Acceptance criteria

-   An Admin can import a valid NBE JSON package and see a normalized
    draft preview.
-   The imported definition uses the existing
    configuration/report-definition engine.
-   No sample financial values are silently promoted into a new
    template.
-   Titles, subtitles, row/section labels and column headers are
    preserved.
-   Invalid packages fail safely with actionable errors.
-   The imported report remains governed by the existing configuration
    approval/publish lifecycle.
-   All existing tests remain green.

### Deliverables

-   Import UI.
-   Server/API import endpoint.
-   JSON schema/version adapter.
-   Normalization service.
-   Import audit/source metadata.
-   Automated tests.
-   Documentation/update to implementation status, changelog and
    completion gates.
