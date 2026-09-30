#!/usr/bin/env python3
"""
Canonical Knowledge Base Normalizer for .ai/
Oromia Bank NBE Regulatory Reporting Platform
Author: Autonomous Engineering Agent (Phase 0)
"""

import os
import glob
import re
import shutil

AI_DIR = os.path.abspath('.ai')

# 1. Canonical Files Specification (00 to 28)
CANONICAL_SPEC = [
    {
        "num": "00",
        "file": "00_START_HERE.md",
        "title": "OB APPLICATION — MASTER AI INDEX & START HERE",
        "purpose": "Master entry point, knowledge base catalog, session reading order, and migration safety protocol",
        "when": "Mandatory first read on every new AI session, account migration, or ZIP restoration"
    },
    {
        "num": "01",
        "file": "01_MASTER_AUTONOMOUS_ENGINEER.md",
        "title": "AUTONOMOUS PRINCIPAL FULL-STACK ENGINEER DIRECTIVE",
        "purpose": "Autonomous engineer directive for identity, authentication, biometrics, security, and hardware diagnostics",
        "when": "When implementing or debugging authentication, security, biometric hardware, or identity systems"
    },
    {
        "num": "02",
        "file": "02_OB_SYSTEM_SPECIFICATION.md",
        "title": "OB NBE REPORTING SYSTEM AUTONOMOUS FULL-STACK MASTER SPECIFICATION",
        "purpose": "Comprehensive regulatory reporting platform master prompt, design system, and banking specifications",
        "when": "During system onboarding, architectural review, or full-system feature development"
    },
    {
        "num": "03",
        "file": "03_CONTINUATION_AND_RECOVERY.md",
        "title": "CONTINUATION & RECOVERY PROTOCOL",
        "purpose": "Quick health verification commands, system architecture map, and task resumption checklist",
        "when": "When resuming work, recovering from timeouts/quotas, or verifying build and test health"
    },
    {
        "num": "04",
        "file": "04_PROJECT_MEMORY.md",
        "title": "PROJECT MEMORY & STATE",
        "purpose": "Persistent project memory, institutional facts (InstCode 0000013), stack baseline, and verification gates",
        "when": "Before starting any task; consulted on every turn for verified system state"
    },
    {
        "num": "05",
        "file": "05_SYSTEM_REQUIREMENTS.md",
        "title": "SYSTEM REQUIREMENTS SPECIFICATION (SRS)",
        "purpose": "Functional (P0-P2), technical, and SLA requirements for NBE regulatory returns and workflows",
        "when": "When verifying business logic, compliance directives, or feature requirements"
    },
    {
        "num": "06",
        "file": "06_ARCHITECTURE.md",
        "title": "ARCHITECTURE & SYSTEM DESIGN SPECIFICATION",
        "purpose": "Clean full-stack architecture (Express on port 3000 + React 19 SPA) and end-to-end data pipelines",
        "when": "When reviewing or modifying system topology, data flow, or server-client boundaries"
    },
    {
        "num": "07",
        "file": "07_SSOT.md",
        "title": "SINGLE SOURCE OF TRUTH (SSOT) SPECIFICATION",
        "purpose": "Single Source of Truth governance principles and authoritative registry definitions",
        "when": "When adding or updating business rules, schemas, or role configurations"
    },
    {
        "num": "08",
        "file": "08_DEPARTMENT_CATALOG.md",
        "title": "OROMIA BANK DEPARTMENT CATALOG & ORGANIZATIONAL HIERARCHY",
        "purpose": "8 official Oromia Bank departments, short codes, return mappings, and isolation principles",
        "when": "When working on departmental data isolation, report assignment, or access scopes"
    },
    {
        "num": "09",
        "file": "09_REPORT_CATALOG.md",
        "title": "NBE REPORT CATALOG & ASSET REGISTRY",
        "purpose": "Index of all 24 NBE regulatory returns, cryptographic SHA-256 hashes, field counts, and dynamic schedules",
        "when": "When inspecting return definitions, field codes, or dynamic schedule properties"
    },
    {
        "num": "10",
        "file": "10_REPORT_SCHEMA_ANALYSIS.md",
        "title": "NBE REPORT SCHEMA & CONTRACT DISCOVERY ANALYSIS",
        "purpose": "Global NBE report envelope contract, field validation schemas, and mathematical formula specifications",
        "when": "When implementing or debugging report rendering, validation rules, or AST formulas"
    },
    {
        "num": "11",
        "file": "11_NBE_CONTRACT.md",
        "title": "NBE REGULATORY CONTRACT ANALYSIS",
        "purpose": "NBE regulatory intake contract, confirmed facts, simulator failure modes, and API settings",
        "when": "When working on NBE transmission, HTTP adapter, simulator scenarios, or network retries"
    },
    {
        "num": "12",
        "file": "12_RBAC_MATRIX.md",
        "title": "ROLE-BASED ACCESS CONTROL (RBAC) MATRIX",
        "purpose": "Role matrix (Admin, Maker, Checker, Auditor, System), Segregation of Duties, and BSD/03/2020 rules",
        "when": "When modifying authorization, route guards, user permissions, or 4-eyes workflows"
    },
    {
        "num": "13",
        "file": "13_CURRENT_IMPLEMENTATION_STATUS.md",
        "title": "CURRENT IMPLEMENTATION STATUS & VERIFICATION GATES",
        "purpose": "Comprehensive implementation status, module matrix, 16-component route inventory across 9 viewports, and gates",
        "when": "To check verified features, recent phase completions, and outstanding work"
    },
    {
        "num": "14",
        "file": "14_CHANGELOG.md",
        "title": "CHANGELOG",
        "purpose": "Chronological version history, feature additions, fixes, and architectural adjustments",
        "when": "To review past engineering actions and record all new modifications"
    },
    {
        "num": "15",
        "file": "15_AUTH_SEED_DATA_AND_BIOMETRIC_TESTING.md",
        "title": "AUTHENTICATION SEED DATA & BIOMETRIC TESTING SPECIFICATION",
        "purpose": "Authoritative development seed accounts, credentials, and biometric test harness specifications",
        "when": "When testing authentication, login presets, WebAuthn passkeys, or facial recognition"
    },
    {
        "num": "16",
        "file": "16_BACKEND_DJANGO_ARCHITECTURE.md",
        "title": "BACKEND ARCHITECTURE & DJANGO AUDIT NOTICE",
        "purpose": "Clarification on Node.js/Express full-stack reality and audit notice regarding Django references",
        "when": "When examining backend structure to prevent misconceptions about runtime stack"
    },
    {
        "num": "17",
        "file": "17_UI_UX_RESPONSIVENESS_AUDIT_AND_ENHANCEMENT.md",
        "title": "UI/UX, RESPONSIVE DESIGN AND PAGE-LAYOUT SPECIFICATION",
        "purpose": "Frontend Design Constitution, zero-pill discipline, 9-viewport responsive matrix, and UI audit",
        "when": "When styling, designing layouts, or fixing responsive UI behavior"
    },
    {
        "num": "18",
        "file": "18_NBE_SIMULATOR_MICROSERVICE.md",
        "title": "NBE CENTRAL BANK SIMULATOR MICROSERVICE & INTEGRATION GUIDE",
        "purpose": "Local NBE Central Bank simulator microservice, 6 configurable failure modes, receipts, and mTLS",
        "when": "When testing submission workflows, error resilience, or simulated NBE responses"
    },
    {
        "num": "19",
        "file": "19_AUDITOR_ROLE_AND_AUDIT_WORKFLOW.md",
        "title": "AUDITOR ROLE & AUDIT WORKFLOW SPECIFICATION",
        "purpose": "First-class Compliance Auditor role, 7 audit modules, cryptographic evidence seals, and reports",
        "when": "When working on compliance audits, findings lifecycles, evidence seals, or auditor UX"
    },
    {
        "num": "20",
        "file": "20_ACCOUNT_MIGRATION_AND_CONTINUATION.md",
        "title": "ACCOUNT MIGRATION & CONTINUATION PROTOCOL",
        "purpose": "Account migration protocol, ZIP transfer procedures, quota safety rules, and post-migration checks",
        "when": "During or immediately after account migration or ZIP import/export"
    },
    {
        "num": "21",
        "file": "21_WORKFLOW_MODEL.md",
        "title": "WORKFLOW & SUBMISSION STATE MACHINE MODEL",
        "purpose": "Regulatory submission lifecycle, state machine transitions, and conflict-of-interest guards",
        "when": "When implementing or testing report states (Draft -> Submitted -> Approved -> Sent)"
    },
    {
        "num": "22",
        "file": "22_SECURITY_MODEL.md",
        "title": "SECURITY MODEL & COMPLIANCE SPECIFICATION",
        "purpose": "Defense-in-depth security model, IDOR protection, CSRF, TLS, idempotency keys, and audit logs",
        "when": "When implementing or auditing security-critical endpoints, data access, or cryptography"
    },
    {
        "num": "23",
        "file": "23_DEVELOPMENT_PLAN.md",
        "title": "DEVELOPMENT PLAN & ARCHITECTURE",
        "purpose": "Metadata-driven dynamic engine design, Excel service, and Phase 2 SSOT pipelines",
        "when": "When extending platform capabilities, data connectors, or dynamic area tables"
    },
    {
        "num": "24",
        "file": "24_DECISIONS.md",
        "title": "ARCHITECTURAL DECISION RECORDS (ADR)",
        "purpose": "ADRs 001 through 006 capturing foundational technical choices and rationale",
        "when": "When questioning architectural patterns or evaluating alternative approaches"
    },
    {
        "num": "25",
        "file": "25_TASK_QUEUE.md",
        "title": "TASK QUEUE",
        "purpose": "Master engineering task queue, priorities, dependencies, acceptance criteria, and status",
        "when": "To identify the next assigned engineering task and track implementation progress"
    },
    {
        "num": "26",
        "file": "26_REQUIREMENTS_TRACEABILITY.md",
        "title": "REQUIREMENTS TRACEABILITY MATRIX",
        "purpose": "Traceability matrix linking NBE regulatory requirements to code files and test suites",
        "when": "To verify that regulatory requirements have corresponding implementations and tests"
    },
    {
        "num": "27",
        "file": "27_KNOWN_ISSUES.md",
        "title": "KNOWN ISSUES & RESOLUTION LOG",
        "purpose": "Known issues, edge cases, mitigation strategies, and resolved bug histories",
        "when": "Before investigating anomalies or reporting new defects"
    },
    {
        "num": "28",
        "file": "28_COMPLETION_EVIDENCE.md",
        "title": "COMPLETION EVIDENCE & VERIFICATION LOG",
        "purpose": "Executable verification evidence, gate-by-gate test results, and sign-off criteria",
        "when": "To verify that all quality gates pass before declaring any engineering phase complete"
    }
]

def step5_reference_repair():
    print("=== STEP 5: Repairing internal references across all canonical files ===")
    
    replacements = [
        # Start Here / Master Prompts
        (r'\b01_START_HERE\.md\b', '00_START_HERE.md'),
        (r'\bSTART_HERE\.md\b', '00_START_HERE.md'),
        (r'\b03_MASTER_AUTONOMOUS_ENGINEER\.md\b', '01_MASTER_AUTONOMOUS_ENGINEER.md'),
        (r'\bMASTER_AUTONOMOUS_ENGINEER\.md\b', '01_MASTER_AUTONOMOUS_ENGINEER.md'),
        (r'\b02_MASTER_PROMPT\.md\b', '02_OB_SYSTEM_SPECIFICATION.md'),
        (r'\bMASTER_PROMPT\.md\b', '02_OB_SYSTEM_SPECIFICATION.md'),
        (r'\bOB_SYSTEM_SPECIFICATION\.md\b', '02_OB_SYSTEM_SPECIFICATION.md'),
        (r'\bOB_AUTONOMOUS_MASTER_PROMPT\.md\b', '02_OB_SYSTEM_SPECIFICATION.md'),
        
        # Recovery
        (r'\bRECOVERY\.md\b', '03_CONTINUATION_AND_RECOVERY.md'),
        (r'\bRECOVERY_PROTOCOL\.md\b', '03_CONTINUATION_AND_RECOVERY.md'),
        (r'\bRECOVERY_AND_CONTINUE\.md\b', '03_CONTINUATION_AND_RECOVERY.md'),
        (r'\bRECOVER_AND_CONTINUE\.md\b', '03_CONTINUATION_AND_RECOVERY.md'),
        (r'\bAI_RECOVERY_PROTOCOL\.md\b', '03_CONTINUATION_AND_RECOVERY.md'),
        
        # Core Architecture & Catalogs
        (r'(?<!04_)\bPROJECT_MEMORY\.md\b', '04_PROJECT_MEMORY.md'),
        (r'(?<!05_)\bSYSTEM_REQUIREMENTS\.md\b', '05_SYSTEM_REQUIREMENTS.md'),
        (r'(?<!06_)\bARCHITECTURE\.md\b', '06_ARCHITECTURE.md'),
        (r'(?<!07_)\bSSOT\.md\b', '07_SSOT.md'),
        (r'(?<!08_)\bDEPARTMENT_CATALOG\.md\b', '08_DEPARTMENT_CATALOG.md'),
        (r'(?<!09_)\bREPORT_CATALOG\.md\b', '09_REPORT_CATALOG.md'),
        (r'(?<!10_)\bREPORT_SCHEMA_ANALYSIS\.md\b', '10_REPORT_SCHEMA_ANALYSIS.md'),
        (r'(?<!11_)\bNBE_CONTRACT\.md\b', '11_NBE_CONTRACT.md'),
        (r'(?<!12_)\bRBAC_MATRIX\.md\b', '12_RBAC_MATRIX.md'),
        
        # Status & Changelog
        (r'(?<!13_)\bCURRENT_IMPLEMENTATION_STATUS\.md\b', '13_CURRENT_IMPLEMENTATION_STATUS.md'),
        (r'(?<!13_)\bIMPLEMENTATION_STATUS\.md\b', '13_CURRENT_IMPLEMENTATION_STATUS.md'),
        (r'(?<!14_)\bCHANGELOG\.md\b', '14_CHANGELOG.md'),
        
        # Seed & Backend
        (r'(?<!15_)\bAUTH_SEED_DATA_AND_BIOMETRIC_TESTING\.md\b', '15_AUTH_SEED_DATA_AND_BIOMETRIC_TESTING.md'),
        (r'(?<!16_)\bBACKEND_DJANGO_ARCHITECTURE\.md\b', '16_BACKEND_DJANGO_ARCHITECTURE.md'),
        (r'(?<!17_)\bUI_UX_RESPONSIVENESS_AUDIT_AND_ENHANCEMENT\.md\b', '17_UI_UX_RESPONSIVENESS_AUDIT_AND_ENHANCEMENT.md'),
        (r'(?<!18_)\bNBE_SIMULATOR_MICROSERVICE\.md\b', '18_NBE_SIMULATOR_MICROSERVICE.md'),
        (r'(?<!19_)\bAUDITOR_ROLE_AND_AUDIT_WORKFLOW\.md\b', '19_AUDITOR_ROLE_AND_AUDIT_WORKFLOW.md'),
        
        # Account Continuation
        (r'\b20_ACCOUNT_C_MIGRATION_AND_CONTINUATION\.md\b', '20_ACCOUNT_MIGRATION_AND_CONTINUATION.md'),
        (r'\bACCOUNT_C_MIGRATION_AND_CONTINUATION\.md\b', '20_ACCOUNT_MIGRATION_AND_CONTINUATION.md'),
        (r'\bACCOUNT_MIGRATION_PROTOCOL\.md\b', '20_ACCOUNT_MIGRATION_AND_CONTINUATION.md'),
        
        # Workflows, Security, Decisions
        (r'(?<!21_)\bWORKFLOW_MODEL\.md\b', '21_WORKFLOW_MODEL.md'),
        (r'(?<!22_)\bSECURITY_MODEL\.md\b', '22_SECURITY_MODEL.md'),
        (r'(?<!23_)\bDEVELOPMENT_PLAN\.md\b', '23_DEVELOPMENT_PLAN.md'),
        (r'(?<!24_)\bDECISIONS\.md\b', '24_DECISIONS.md'),
        (r'(?<!25_)\bTASK_QUEUE\.md\b', '25_TASK_QUEUE.md'),
        (r'(?<!26_)\bREQUIREMENTS_TRACEABILITY\.md\b', '26_REQUIREMENTS_TRACEABILITY.md'),
        (r'(?<!27_)\bKNOWN_ISSUES\.md\b', '27_KNOWN_ISSUES.md'),
        (r'(?<!28_)\bCOMPLETION_EVIDENCE\.md\b', '28_COMPLETION_EVIDENCE.md'),
        (r'\bCOMPLETION_CRITERIA\.md\b', '28_COMPLETION_EVIDENCE.md'),
        (r'\bFINAL_VERIFICATION\.md\b', '28_COMPLETION_EVIDENCE.md'),
        (r'\bCOMPLETION_REPORT\.md\b', '28_COMPLETION_EVIDENCE.md'),

        # Secondary hypothetical names mapped to canonical specifications
        (r'\bAUDIT_MODEL\.md\b', '19_AUDITOR_ROLE_AND_AUDIT_WORKFLOW.md'),
        (r'\bAPI_CONTRACTS\.md\b', '11_NBE_CONTRACT.md'),
        (r'\bDATABASE_MODEL\.md\b', '06_ARCHITECTURE.md'),
        (r'\bUI_UX_SPEC\.md\b', '17_UI_UX_RESPONSIVENESS_AUDIT_AND_ENHANCEMENT.md'),
        (r'\bUI_UX_REQUIREMENTS\.md\b', '17_UI_UX_RESPONSIVENESS_AUDIT_AND_ENHANCEMENT.md'),
        (r'\bTEST_PLAN\.md\b', '28_COMPLETION_EVIDENCE.md'),
        (r'\bTEST_STATUS\.md\b', '28_COMPLETION_EVIDENCE.md'),
        (r'\bTEST_STRATEGY\.md\b', '28_COMPLETION_EVIDENCE.md'),
        (r'\bSECURITY_REVIEW\.md\b', '22_SECURITY_MODEL.md'),
        (r'\bSECURITY_REQUIREMENTS\.md\b', '22_SECURITY_MODEL.md'),
        (r'\bDATA_CONTRACT\.md\b', '10_REPORT_SCHEMA_ANALYSIS.md'),
        (r'\bNBE_API_CONTRACT\.md\b', '11_NBE_CONTRACT.md'),
        (r'\bAI_DEVELOPMENT_CONTRACT\.md\b', '01_MASTER_AUTONOMOUS_ENGINEER.md'),
        (r'\bAGENT_RULES\.md\b', '01_MASTER_AUTONOMOUS_ENGINEER.md'),
        (r'\bCONTRACT\.md\b', '01_MASTER_AUTONOMOUS_ENGINEER.md'),
    ]

    canonical_filenames = [spec['file'] for spec in CANONICAL_SPEC]
    
    total_replaces = 0
    for fname in canonical_filenames:
        path = os.path.join(AI_DIR, fname)
        if not os.path.exists(path):
            continue
        with open(path, 'r', errors='ignore') as fp:
            text = fp.read()
            
        modified = text
        for pattern, replacement in replacements:
            modified = re.sub(pattern, replacement, modified)
            
        if modified != text:
            with open(path, 'w') as fp:
                fp.write(modified)
            total_replaces += 1
            print(f"Repaired references in {fname}")
            
    print(f"Reference repair completed across {total_replaces} canonical files.")

def step7_verify():
    print("=== STEP 7: Validating final knowledge base state ===")
    canonical_filenames = set(spec['file'] for spec in CANONICAL_SPEC)
    current_files = sorted(os.listdir(AI_DIR))
    
    md_files = [f for f in current_files if f.endswith('.md')]
    print(f"Total markdown files remaining in .ai/: {len(md_files)}")
    
    missing = canonical_filenames - set(md_files)
    unexpected = set(md_files) - canonical_filenames
    
    if missing:
        print(f"ERROR: Missing canonical files: {missing}")
    if unexpected:
        print(f"ERROR: Unexpected extra files: {unexpected}")
        
    if not missing and not unexpected:
        print("SUCCESS! Exactly 29 canonical files exist in .ai/ from 00 to 28.")
        for f in md_files:
            size = os.path.getsize(os.path.join(AI_DIR, f))
            print(f"  {f:45} ({size:6} bytes)")

if __name__ == '__main__':
    step5_reference_repair()
    step7_verify()
