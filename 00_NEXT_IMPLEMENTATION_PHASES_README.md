# Oromia Bank NBE Reporting Platform --- Next Implementation Phases

## Purpose

This package converts the requested enhancements into an ordered
implementation roadmap for the next development cycle after Phase 30.

The current project baseline is treated as authoritative: Phase 30 is
documented as completed and verified, including maker lifecycle,
validation remediation, role-based Library governance, dashboard
responsibility cleanup, SSOT concurrency protection, responsive testing,
and accessibility checks. The existing implementation already has a
metadata-driven report-definition engine, immutable template versioning,
dynamic form rendering, and an NBE adapter/simulator.

## Source-aligned baseline

-   Phase 30 is the current verified integration/security/regression
    baseline.
-   Existing report definitions are metadata-driven and already support
    sections, fields, schedule columns, formulas, validation and NBE
    mappings.
-   Existing configuration governance already provides Draft → Validate
    → Impact Analysis → Dual Review/Approval → Publish → Effective →
    Audit.
-   Existing dynamic forms consume active metadata snapshots and
    historical submissions retain immutable template snapshots.
-   Existing NBE integration includes an adapter and simulator.
-   Existing Maker/Checker/Auditor/Admin role separation and dashboard
    route protection must be preserved.

## Recommended implementation sequence

  ---------------------------------------------------------------------------------
  Phase             Name                    Primary outcome       Depends on
  ----------------- ----------------------- --------------------- -----------------
  31                NBE JSON Report Package Import an             Existing Phase
                    Import & Schema         NBE-provided JSON     4/8 configuration
                    Normalization           package and convert   architecture
                                            it into a validated   
                                            OB report-definition  
                                            draft                 

  32                Dynamic NBE API         Register the endpoint Phase 31
                    Endpoint Registry &     from the imported     
                    Simulator Integration   package, securely     
                                            connect it to the NBE 
                                            simulator, and expose 
                                            the new report        
                                            dynamically           

  33                Empty Template          Ensure new reports    Phase 31
                    Initialization & Maker  open as clean         
                    Data-Entry Semantics    templates with safe,  
                                            schema-aware initial  
                                            values/placeholders   
                                            and no misleading     
                                            validation noise      

  34                Administrator Template  Give Admin controlled Phase 31 + Phase
                    Governance & Maker      title/structure       33
                    Title Immutability      editing while         
                                            preventing Makers     
                                            from changing         
                                            report-definition     
                                            content               

  35                Role-Locked Dashboards  Remove dashboard      Existing RBAC +
                    & Notification-Centered switching, enforce    Phase 30
                    Navigation              role-only dashboard   
                                            access, remove NBE    
                                            Simulator from        
                                            non-Admin dashboards, 
                                            and add notification  
                                            navigation            

  36                Maker-Selected Checker  Let Makers select one Existing
                    Assignment &            or multiple eligible  Maker/Checker
                    Notification Workflow   same-department       workflow + Phase
                                            Checkers during       35
                                            submission and drive  
                                            the resulting         
                                            workflow through      
                                            notifications         

  37                Cross-Phase             Prove all new         Phases 31--36
                    Integration, Security,  capabilities work     
                    Regression & Acceptance together without      
                                            weakening existing    
                                            controls              
  ---------------------------------------------------------------------------------

## Important design rule for empty fields

The requested "default placeholder values" must not become fake
regulatory data.

Use a distinction between:

1.  **Display placeholder** --- shown to help the Maker understand what
    belongs in the field.
2.  **Schema-defined initial value** --- used only where the NBE schema
    explicitly permits a neutral default such as `0`, `0.00`, `0%`, or
    an empty collection.
3.  **Missing/required state** --- remains empty when the field
    genuinely requires a business value.

The implementation must not manufacture financial facts merely to
suppress validation. Validation warnings should be suppressed only when
the field is genuinely optional or has an approved schema-defined
initial value. Required business fields must still become blocking
errors at the appropriate validation/submission stage.

## Completion expectation

Every phase prompt is written as an implementation prompt for the coding
agent. Each phase must:

-   inspect the existing implementation before changing it;
-   preserve authoritative server/SSOT behavior;
-   reuse existing services instead of creating parallel architecture;
-   add automated tests;
-   preserve auditability and version history;
-   enforce role and department boundaries server-side;
-   avoid weakening existing validation or regulatory controls;
-   update implementation-status/changelog/completion-gate documentation
    when the phase is completed.

## Files in this package

-   `31_NBE_JSON_REPORT_PACKAGE_IMPORT_AND_SCHEMA_NORMALIZATION.md`
-   `32_DYNAMIC_NBE_API_ENDPOINT_REGISTRY_AND_SIMULATOR_INTEGRATION.md`
-   `33_EMPTY_TEMPLATE_INITIALIZATION_AND_MAKER_DATA_ENTRY.md`
-   `34_ADMIN_TEMPLATE_GOVERNANCE_AND_MAKER_TITLE_IMMUTABILITY.md`
-   `35_ROLE_LOCKED_DASHBOARDS_AND_NOTIFICATION_NAVIGATION.md`
-   `36_MAKER_SELECTED_CHECKER_ASSIGNMENT_AND_NOTIFICATION_WORKFLOW.md`
-   `37_CROSS_PHASE_INTEGRATION_SECURITY_REGRESSION_AND_ACCEPTANCE.md`
-   `00_NEXT_IMPLEMENTATION_PHASES_README.md`
