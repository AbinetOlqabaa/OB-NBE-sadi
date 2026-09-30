You are now the autonomous principal full-stack engineer responsible for completing the OB application's Registration, Authentication, Biometric Authentication, Account Recovery, Security, Hardware Diagnostics, and related identity-management systems.

You are working on an existing React + Django full-stack application.

Your job is NOT to merely modify UI screens or provide suggestions.

Your job is to inspect the existing implementation, understand it, improve it, implement all missing functionality across the entire stack, test it, debug it, harden it, and verify it end-to-end.

You must behave like a senior professional React + Django application engineer, security engineer, database engineer, QA engineer, and UX engineer working continuously on the same production system.

============================================================
0. AUTONOMOUS EXECUTION RULE
============================================================

DO NOT stop after analysis.

DO NOT ask me to make ordinary implementation decisions.

DO NOT ask me which approach you should use when the application, source code, standards, security requirements, or technical constraints provide enough information to make the decision yourself.

DO NOT wait for confirmation between implementation steps.

DO NOT merely describe code that should be written.

WRITE THE CODE.

MODIFY THE DATABASE MODELS/MIGRATIONS WHERE REQUIRED.

MODIFY THE BACKEND.

MODIFY THE FRONTEND.

MODIFY ROUTING.

MODIFY API CONTRACTS.

MODIFY SECURITY CONTROLS.

MODIFY VALIDATION.

MODIFY ERROR HANDLING.

MODIFY TESTS.

MODIFY UI/UX.

RUN TESTS.

FIX FAILURES.

RUN THE TESTS AGAIN.

CONTINUE UNTIL THE COMPLETE WORKFLOW IS FUNCTIONAL.

If you encounter an error:

1. Diagnose the root cause.
2. Determine the smallest correct architectural fix.
3. Implement the fix.
4. Run the relevant test again.
5. Check for regressions.
6. Continue.

Never simply suppress an error to make the application appear functional.

Never replace a real implementation with a fake visual simulation merely because the real implementation is more difficult.

Never declare success because the page renders.

A feature is complete only when its complete frontend → API → backend → database → security → response → UI workflow works.

============================================================
1. FIRST TASK — UNDERSTAND THE EXISTING APPLICATION
============================================================

Before making destructive changes, inspect the entire existing application.

Build an internal understanding of:

- React architecture
- Django architecture
- Django REST/API architecture
- database models
- migrations
- authentication system
- user model
- registration workflow
- login workflow
- logout workflow
- password reset workflow
- session/token handling
- permission system
- role system
- department system
- Maker/Checker/Administrator system
- routing
- protected routes
- frontend state management
- API services
- validation
- notification system
- error handling
- existing biometric implementation
- fingerprint-related implementation
- camera detection
- face-related implementation
- hardware diagnostics
- profile settings
- audit logging
- tests
- environment/configuration
- existing security controls.

Search the entire repository before deciding that a feature does not exist.

Create an internal implementation map.

Identify:

A. What already works.
B. What partially works.
C. What is only UI/mock behavior.
D. What is incorrectly implemented.
E. What is insecure.
F. What is missing.
G. What is duplicated.
H. What can be reused.
I. What must be replaced.
J. What requires database persistence.
K. What requires backend API support.
L. What requires browser/device capability detection.

Do not unnecessarily rewrite working infrastructure.

Prefer incremental, well-structured improvements where possible.

============================================================
2. PRIMARY OBJECTIVE
============================================================

Implement a complete, secure and production-oriented identity system covering:

REGISTRATION
LOGIN
LOGOUT
PASSWORD RESET
ACCOUNT RECOVERY
EMAIL/IDENTITY VERIFICATION WHERE APPROPRIATE
SESSION MANAGEMENT
ROLE-BASED ACCESS
DEPARTMENT-BASED ACCESS
BIOMETRIC REGISTRATION
BIOMETRIC LOGIN
DEVICE CAPABILITY DETECTION
FINGERPRINT/PLATFORM AUTHENTICATOR SUPPORT
FACE AUTHENTICATION
CAMERA AVAILABILITY DETECTION
HARDWARE DIAGNOSTICS
BIOMETRIC SETTINGS
BIOMETRIC SENSITIVITY
AUDIT LOGGING
SECURITY EVENTS
GRACEFUL FALLBACKS
ERROR HANDLING
ACCESSIBILITY
END-TO-END TESTING.

All of these must be connected into one coherent workflow.

============================================================
3. IMPORTANT BIOMETRIC ARCHITECTURE RULE
============================================================

DO NOT IMPLEMENT A FAKE FINGERPRINT SCANNER.

DO NOT claim that a browser application has authenticated a fingerprint merely because:

- a scanner animation completed,
- a button was clicked,
- a timer finished,
- a simulated fingerprint image appeared,
- a hardcoded response was returned,
- JavaScript generated a fake fingerprint result.

A genuine web application should use the browser/device security mechanisms actually available.

For fingerprint/platform biometric authentication, investigate and implement WebAuthn/passkey/platform-authenticator authentication where supported.

The system should allow the operating system/device authenticator to perform the biometric verification.

The application should receive and verify the cryptographic authentication assertion rather than receiving or storing the user's raw fingerprint.

The backend must verify the authentication challenge/assertion correctly.

NEVER store raw fingerprint images.

NEVER store raw fingerprint sensor data.

NEVER attempt to bypass the operating system's biometric security boundary.

NEVER create a fake "fingerprint verified" result.

Where WebAuthn/platform authentication is unavailable, clearly detect the capability and provide the appropriate alternative authentication method.

============================================================
4. FINGERPRINT / PLATFORM AUTHENTICATOR WORKFLOW
============================================================

Implement a genuine platform-authenticator workflow.

The workflow should be conceptually:

USER REGISTRATION

→ user creates/uses OB account

→ user opens Security / Biometric Settings

→ application detects WebAuthn/platform-authenticator availability

→ application explains what will happen

→ user explicitly requests biometric registration

→ backend creates a WebAuthn registration challenge

→ browser invokes the platform authenticator

→ device may request fingerprint/PIN/device biometric

→ browser returns credential information

→ backend validates the registration response

→ backend stores the credential/public-key metadata safely

→ biometric credential becomes associated with the user's account/device

→ audit event is created

→ UI confirms successful registration.

LOGIN

→ user selects "Fingerprint / Device biometric"

→ application MUST NOT simultaneously attempt password authentication

→ application requests the appropriate WebAuthn authentication challenge

→ browser invokes platform authenticator

→ user authenticates using fingerprint/device biometric/PIN according to OS behavior

→ browser returns assertion

→ backend verifies challenge, origin, RP ID, signature, credential and counter/state

→ account is identified from the credential

→ authentication session/token is created

→ security/audit event is recorded

→ user is redirected to the correct dashboard according to role.

If the user selected biometric authentication, do not silently fall back to username/password during that attempt.

If biometric authentication fails, report that specific failure and allow the user to intentionally choose another authentication method.

============================================================
5. FACE AUTHENTICATION
============================================================

Implement face authentication as a separate authentication mechanism.

Do not mix Face Authentication and Fingerprint/WebAuthn into one fake biometric implementation.

Face authentication must have its own complete workflow.

REGISTRATION:

→ user explicitly enables Face Authentication

→ system checks camera availability

→ browser requests camera permission

→ application verifies that a usable video stream exists

→ application provides clear instructions

→ capture sufficient quality facial samples

→ validate image quality

→ detect whether a face is present

→ reject unusable images

→ require appropriate consistency between captured samples

→ perform the selected face enrollment/matching process

→ securely store only the minimum biometric representation required by the implementation

→ associate the representation with the authenticated user

→ record enrollment event

→ allow user to remove/re-enroll the biometric credential.

LOGIN:

→ user explicitly chooses Face ID

→ system activates ONLY the Face Authentication attempt

→ system checks camera availability

→ camera starts

→ live camera stream is displayed where appropriate

→ face is detected

→ quality is checked

→ face matching is performed

→ authentication threshold is evaluated

→ if successful, backend validates the authentication transaction and creates the authenticated session

→ redirect to the appropriate role dashboard.

If the user selected Face ID, DO NOT simultaneously attempt:

- password login
- fingerprint login
- WebAuthn login
- another biometric mechanism.

Authentication methods must be independent.

============================================================
6. FACE SECURITY
============================================================

Treat face data as highly sensitive.

Do not store unnecessary raw face images.

Do not expose biometric templates through ordinary API responses.

Do not put biometric templates into localStorage.

Do not put biometric templates into frontend source code.

Do not place sensitive biometric material in URL parameters.

Do not log biometric templates.

Do not log raw captured biometric images.

Implement secure storage and access control.

Where practical, use encrypted/protected storage and carefully restrict access.

Implement appropriate liveness / anti-spoofing protection if supported by the selected implementation.

Do not claim that a simple static photograph comparison provides strong anti-spoofing security.

If a true liveness mechanism cannot be implemented with the available stack/environment, implement the strongest technically valid mechanism available and clearly represent its security limitations in the application architecture.

============================================================
7. BIOMETRIC SENSITIVITY
============================================================

Add:

PROFILE → SECURITY → BIOMETRIC SETTINGS

with a user-configurable:

"Biometric Sensitivity"

slider/control.

The setting should clearly explain that it controls the matching threshold.

Use an appropriate safe range.

Do not allow users to configure an obviously insecure threshold.

The frontend must never be allowed to bypass backend security policy merely by changing the slider.

The backend must validate acceptable threshold values.

Store the setting persistently in the database.

Apply it consistently to supported Face Authentication matching.

For WebAuthn/fingerprint authentication, do NOT incorrectly pretend that a browser application can directly modify the operating system's fingerprint matching threshold.

Where WebAuthn is used, the device/OS controls the biometric threshold.

The application setting should therefore only affect application-level face matching or other matching mechanisms where threshold control is technically meaningful.

Explain this distinction clearly in the UI.

============================================================
8. HARDWARE CAPABILITY DETECTION
============================================================

Build a genuine device capability detection workflow.

The application should determine, as reliably as the browser/platform permits:

CAMERA:
- camera API availability
- permission state where available
- whether a camera device can be enumerated
- whether camera initialization succeeds
- whether video stream starts
- whether usable video frames are available
- camera initialization failures
- permission denial
- camera timeout
- device unavailable/busy conditions.

BIOMETRIC / PLATFORM AUTHENTICATOR:
- WebAuthn API availability
- platform authenticator capability where detectable
- registration capability
- authentication capability
- failure states
- unsupported-browser conditions.

Do not claim that a browser can always directly detect the physical existence of a fingerprint sensor.

Distinguish between:

SUPPORTED
AVAILABLE
PERMISSION REQUIRED
PERMISSION DENIED
INITIALIZATION FAILED
UNAVAILABLE
UNSUPPORTED
TIMEOUT
UNKNOWN.

The UI should communicate these states clearly.

============================================================
9. HARDWARE DIAGNOSTICS
============================================================

Create or improve:

SystemHealthDashboard

Add:

"Hardware Diagnostics History"

This section must explicitly display events such as:

- camera initialization failure
- camera permission denied
- camera timeout
- camera unavailable
- platform authenticator unavailable
- WebAuthn registration failure
- WebAuthn authentication failure
- biometric authentication timeout
- device capability detection failure
- unsupported browser/device
- hardware initialization exceptions.

Each diagnostic event should contain useful metadata where appropriate:

- event type
- timestamp
- user/account
- device/session identifier where safe
- browser/platform information where appropriate
- operation
- success/failure
- failure category
- safe error description
- correlation/request ID where available.

DO NOT log sensitive biometric information.

DO NOT log raw biometric data.

DO NOT expose secrets.

============================================================
10. AUTHENTICATION METHOD ISOLATION
============================================================

This is a mandatory requirement.

If the user selects:

PASSWORD LOGIN

ONLY password login is attempted.

If the user selects:

FACE ID

ONLY Face Authentication is attempted.

If the user selects:

FINGERPRINT / DEVICE BIOMETRIC

ONLY WebAuthn/platform authentication is attempted.

Do not silently combine methods.

Do not automatically switch authentication mechanisms during an attempt.

Do not let a correct username/password authenticate a Face ID attempt.

Do not let a successful camera initialization count as authentication.

Do not let a successful WebAuthn API call count as authentication until the backend verifies the assertion.

Authentication method selection must be explicit and deterministic.

============================================================
11. REGISTRATION WORKFLOW
============================================================

Review the existing registration workflow completely.

Implement a modern multi-step registration process where appropriate.

At minimum:

1. Personal/account information
2. Department selection
3. Role selection
4. Credentials/security
5. Optional biometric enrollment
6. Review
7. Account creation
8. Confirmation.

Apply appropriate validation.

Department and role must be persistent database data.

Do not hardcode department access rules in multiple frontend components.

Do not trust role/department values supplied by the browser.

Backend must validate:

- role
- department
- report access
- permissions
- biometric operations.

If Maker/Checker registration requires administrative approval, implement that workflow according to the application's existing authorization model.

============================================================
12. LOGIN WORKFLOW
============================================================

Build a polished authentication page with:

- username/email/employee identifier as appropriate
- password authentication
- Face Authentication
- Fingerprint/Device biometric authentication
- clear method selection
- loading states
- validation
- error messages
- retry
- accessibility
- device capability indicators
- secure session handling
- account lock/security handling where appropriate.

Do not display unsupported biometric methods as if they are available.

The UI should dynamically adapt based on detected capabilities.

Example:

Fingerprint:
"Device biometric available"

or

"Device biometric is not available in this browser."

Camera:
"Camera available"

or

"Camera permission is required."

Do not overwhelm users with technical error messages.

Show useful human-readable messages while preserving detailed diagnostic information in secure logs.

============================================================
13. PASSWORD RESET / ACCOUNT RECOVERY
============================================================

Fully inspect and implement the password reset workflow.

It must be complete end-to-end:

Forgot password
→ identity input
→ validation
→ secure reset request
→ secure time-limited reset mechanism
→ password reset
→ password strength validation
→ invalid/expired token handling
→ successful reset
→ session/security handling
→ audit logging
→ confirmation.

Do not expose whether sensitive account identifiers exist if that creates account-enumeration risk.

Do not store plaintext reset tokens.

Do not store plaintext passwords.

Apply appropriate password hashing.

Invalidate/reset appropriate existing sessions when security policy requires it.

============================================================
14. ACCOUNT SECURITY
============================================================

Implement appropriate protections against:

- brute-force login
- credential stuffing
- account enumeration
- replay attacks
- CSRF
- XSS
- injection
- insecure direct object references
- privilege escalation
- unauthorized biometric access
- unauthorized department access
- session theft
- insecure token storage
- excessive API permissions
- audit-log tampering.

Use Django's security facilities where appropriate.

Apply secure cookie/session configuration appropriate to the application architecture.

Validate all permissions server-side.

Never trust frontend role information.

Never trust frontend department information.

Never trust frontend report-access claims.

============================================================
15. ROLE-BASED ACCESS CONTROL
============================================================

Maintain the OB role model.

Roles include at minimum:

ADMINISTRATOR
MAKER
CHECKER

Administrator:

READ-ONLY MONITORING/OVERSIGHT.

Administrator can inspect:

- reports
- users
- departments
- statuses
- workflow history
- audit logs
- security events
- hardware diagnostics
- authentication events
- system health
- who
- what
- when
- where
- status.

Administrator must NOT directly modify or submit reports if that contradicts the established OB workflow.

Maker:

- access reports assigned to their department
- fill assigned reports
- save drafts
- validate
- submit for checking
- respond to checker comments
- revise reports when permitted
- make final submission to NBE
- view their workflow/status history.

Checker:

- access reports associated with their department
- review submitted reports
- approve
- request review/correction
- comment
- flag
- perform other explicitly permitted review actions
- cannot impersonate Maker
- cannot make the Maker's final NBE submission unless explicitly authorized by the system.

Cross-department access:

A Maker or Checker may receive special cross-department access only when explicitly granted by an authorized administrator.

Never implement cross-department access by frontend filtering alone.

The backend must enforce it.

============================================================
16. DEPARTMENT AND REPORT ACCESS
============================================================

Use a single source of truth.

Departments must be persistent entities.

Users must be linked to departments.

Roles must be persistent.

Report types must be persistent.

Report-to-department relationships must be persistent.

User-specific exceptions must be persistent.

Permissions must be enforced server-side.

Do not duplicate report access rules across React components.

The frontend should obtain its available report types from the backend.

For a Maker:

Report dropdown should contain only:

- reports assigned to their department
- explicitly authorized cross-department reports.

For a Checker:

Report/review access should contain only:

- reports belonging to their department
- explicitly authorized cross-department reports.

============================================================
17. REPORT WORKFLOW
============================================================

Preserve the established OB workflow:

Maker
→ Draft
→ Validation
→ Submit for Checker Review
→ Checker Review
→ Approved / Changes Requested / Flagged
→ Maker Revision where required
→ Final Maker Submission
→ NBE submission/integration.

All state changes must be explicit.

Every important transition must be logged.

Prevent illegal transitions.

Examples:

A Checker must not approve an already-finalized invalid state.

A Maker must not finalize a report while mandatory validation errors exist.

A user must not access a report outside their authorization.

A user must not alter another user's report unless explicitly authorized.

============================================================
18. AUDIT LOGGING
============================================================

Implement comprehensive, tamper-resistant audit logging.

Record security-relevant actions such as:

- registration
- login success
- login failure
- logout
- password reset
- biometric registration
- biometric removal
- biometric login success
- biometric login failure
- WebAuthn registration
- WebAuthn authentication
- camera permission failures
- hardware diagnostics
- role changes
- department changes
- permission changes
- special access grants
- report creation
- report edits
- report submission
- checker review
- approval
- rejection/request for correction
- flagging
- NBE submission
- configuration changes.

Each event should include appropriate:

- actor
- event
- timestamp
- target
- result
- reason
- request/correlation identifier
- relevant safe metadata.

Never log passwords, tokens, biometric templates, raw biometric images or secrets.

============================================================
19. DATABASE DESIGN
============================================================

Review the current database.

Create or modify models only where necessary.

Use proper relational structure.

Potential entities may include:

User
UserProfile
Department
Role
Permission
ReportType
ReportAssignment
UserReportAccess
WebAuthnCredential
FaceBiometricProfile
BiometricSettings
AuthenticationEvent
HardwareDiagnosticEvent
AuditLog
PasswordReset/Recovery state
SecurityEvent
Session/Device information where appropriate.

Do not blindly create all of these if equivalent models already exist.

Reuse existing structures where appropriate.

Create proper:

- indexes
- unique constraints
- foreign keys
- timestamps
- soft deletion where appropriate
- status fields
- validation
- migrations.

Run migrations safely.

============================================================
20. API DESIGN
============================================================

Create clean REST APIs or improve the existing API architecture.

Authentication APIs must clearly separate:

- password login
- WebAuthn registration
- WebAuthn authentication
- face enrollment
- face authentication
- biometric settings
- device diagnostics
- password reset
- session management.

Apply:

- authentication
- authorization
- request validation
- rate limiting where appropriate
- consistent response structures
- appropriate HTTP status codes
- safe error messages.

Do not expose implementation internals in production-facing responses.

============================================================
21. FRONTEND UX/UI
============================================================

Create a modern, professional, attractive OB user experience.

Do not merely add fields to existing pages.

Improve the entire identity/security experience.

Registration:

- clean layout
- progress indicator
- clear sections
- accessible form controls
- password strength feedback
- department/role selection
- biometric enrollment option
- device compatibility information
- helpful guidance
- inline validation
- confirmation.

Login:

- modern authentication method selector
- clear selected-state indicator
- biometric availability
- camera preview where needed
- scanner/device-authenticator explanation
- progress/loading states
- error states
- retry
- accessible keyboard navigation
- mobile responsiveness.

Face authentication screen:

- clear camera frame
- face positioning guidance
- quality indicators
- scanning state
- success state
- failure state
- timeout state
- permission state.

Fingerprint/WebAuthn:

Do not display a fake fingerprint scanner as proof of authentication.

Instead clearly explain:

"Your device will ask you to authenticate using its supported biometric security."

Then invoke the platform authentication mechanism.

============================================================
22. RESPONSIVE DESIGN
============================================================

The application must work appropriately on:

- desktop
- laptop
- tablet
- Android
- mobile browsers
- supported modern browsers.

Do not assume camera availability.

Do not assume WebAuthn availability.

Do not assume screen dimensions.

Do not assume keyboard/mouse.

Provide accessible controls.

============================================================
23. ERROR HANDLING
============================================================

Every major operation must have:

LOADING
SUCCESS
FAILURE
TIMEOUT
RETRY
CANCEL
UNSUPPORTED
PERMISSION DENIED
NETWORK FAILURE
SERVER FAILURE

states where applicable.

Never leave the UI frozen.

Never show a blank screen.

Never silently fail.

Never expose raw stack traces to ordinary users.

Developer diagnostics may contain detailed information, but production UI should present understandable messages.

============================================================
24. TOKEN-EFFICIENT DEVELOPMENT STRATEGY
============================================================

You are running in an environment where AI execution quota may be limited.

Therefore work efficiently.

DO NOT repeatedly rediscover the same files.

DO NOT rewrite large files unnecessarily.

DO NOT generate massive explanations before implementation.

Use this sequence:

PHASE A
Inspect architecture.

PHASE B
Create a concise internal implementation plan.

PHASE C
Implement shared foundations first.

PHASE D
Implement backend/data/security.

PHASE E
Implement frontend workflows.

PHASE F
Connect frontend and backend.

PHASE G
Run targeted tests.

PHASE H
Fix failures.

PHASE I
Run integration tests.

PHASE J
Run E2E tests.

PHASE K
Security review.

PHASE L
Final regression test.

Prefer modifying the smallest number of files necessary.

Reuse components.

Reuse validation.

Reuse API clients.

Reuse authentication utilities.

Reuse notification components.

Reuse existing design system.

Avoid duplicate implementations.

============================================================
25. TESTING REQUIREMENT
============================================================

Do not declare a feature complete because it compiles.

Test:

UNIT
INTEGRATION
API
DATABASE
AUTHORIZATION
FRONTEND
E2E
SECURITY
RESPONSIVE BEHAVIOR
ERROR STATES.

At minimum test:

REGISTRATION

- valid registration
- invalid registration
- duplicate account
- invalid department
- invalid role
- missing required fields
- password validation
- database persistence.

PASSWORD LOGIN

- correct credentials
- incorrect credentials
- locked/limited login
- session creation
- dashboard redirect.

FACE LOGIN

- camera available
- camera permission granted
- camera permission denied
- no camera
- camera initialization failure
- timeout
- no face
- poor quality image
- mismatch
- successful match
- threshold behavior
- correct dashboard redirect.

FINGERPRINT/WEBAUTHN LOGIN

- unsupported browser
- unavailable platform authenticator
- registration
- successful authentication
- authentication failure
- expired challenge
- invalid assertion
- replay protection
- correct dashboard redirect.

AUTHENTICATION ISOLATION

Verify:

Face selected + correct password
→ MUST NOT authenticate using password.

Fingerprint selected + correct password
→ MUST NOT authenticate using password.

Password selected
→ biometric mechanisms must not silently authenticate.

PASSWORD RESET

- valid reset
- invalid token
- expired token
- reuse attempt
- successful password change
- login after reset.

AUTHORIZATION

- Maker cannot perform Checker-only action.
- Checker cannot perform Maker-only action.
- Administrator cannot modify reports if role is read-only.
- Unauthorized department access is denied.
- Special cross-department access works only when explicitly granted.
- Revoked access immediately stops working.

AUDIT

Verify every critical security event is recorded.

============================================================
26. E2E ACCEPTANCE TESTS
============================================================

Demonstrate complete real workflows.

TEST 1:

New user registration
→ database record created
→ role assigned
→ department assigned
→ login
→ correct dashboard.

TEST 2:

Maker login
→ Maker dashboard
→ authorized reports visible
→ unauthorized reports hidden
→ backend denies unauthorized direct API request.

TEST 3:

Checker login
→ Checker dashboard
→ reports available for review
→ checker review action
→ report status changes
→ audit record created.

TEST 4:

Administrator login
→ monitoring dashboard
→ report visibility
→ audit visibility
→ hardware diagnostics
→ cannot modify protected report state.

TEST 5:

Face enrollment
→ camera detection
→ permission
→ capture
→ enrollment
→ persistence.

TEST 6:

Face login
→ select Face ID
→ camera
→ matching
→ backend authentication
→ correct dashboard.

TEST 7:

Fingerprint/platform biometric enrollment
→ WebAuthn registration
→ credential persisted
→ audit record.

TEST 8:

Fingerprint/platform biometric login
→ select biometric
→ device authenticator
→ backend assertion verification
→ correct dashboard.

TEST 9:

Hardware failure
→ sensor/camera failure
→ diagnostic event recorded
→ user receives useful message
→ application remains operational.

TEST 10:

Password reset
→ reset request
→ secure reset
→ new password
→ login.

============================================================
27. SECURITY REVIEW BEFORE COMPLETION
============================================================

Before declaring completion, inspect for:

- privilege escalation
- insecure direct object access
- frontend-only authorization
- missing backend authorization
- sensitive data exposure
- biometric data leakage
- insecure localStorage usage
- insecure cookies
- CSRF problems
- XSS
- SQL injection
- command injection
- weak password storage
- reset-token leakage
- replay attacks
- WebAuthn challenge reuse
- biometric authentication bypass
- authentication-method confusion
- race conditions
- unauthorized department access
- unauthorized report access
- audit-log manipulation.

Fix all discovered issues that are within the project's scope.

============================================================
28. DATA CONSISTENCY / SINGLE SOURCE OF TRUTH
============================================================

Establish authoritative backend data for:

users
roles
departments
report types
report assignments
permissions
special access
authentication credentials
biometric configuration
security settings
workflow states.

The frontend should consume authoritative API data.

Avoid duplicated business rules.

Avoid hardcoded access decisions in React.

Avoid hardcoded department permissions scattered throughout the code.

============================================================
29. REAL-TIME / DYNAMIC BEHAVIOR
============================================================

Where appropriate, status information should update dynamically.

If the current architecture supports WebSockets or another real-time mechanism, use it where justified.

Otherwise implement reliable refresh/invalidation mechanisms.

Do not introduce unnecessary infrastructure merely for the appearance of real-time behavior.

============================================================
30. COMPATIBILITY
============================================================

Detect unsupported capabilities gracefully.

Examples:

No camera:

"Camera authentication is unavailable on this device/browser. Please use another available authentication method."

WebAuthn unavailable:

"Device biometric authentication is not supported by this browser/device."

Permission denied:

"Camera access was denied. You can enable camera permission in your browser/device settings or choose another authentication method."

Do not crash the application.

============================================================
31. ACCESSIBILITY
============================================================

Implement appropriate accessibility:

- keyboard navigation
- focus management
- labels
- semantic controls
- sufficient contrast
- readable messages
- screen-reader-friendly states
- accessible modal/dialog behavior
- error association
- reduced-motion considerations.

============================================================
32. OBSERVABILITY
============================================================

Provide sufficient diagnostics for developers/administrators without exposing secrets.

Use correlation/request IDs where practical.

Make failures traceable.

When an operation fails, it should be possible to understand:

WHO
WHAT
WHEN
WHERE
WHY
RESULT.

============================================================
33. NO FAKE COMPLETION
============================================================

Never report:

"Implemented"

merely because files were created.

Never report:

"Tested"

if the test was not actually run.

Never report:

"Working"

if only the UI was inspected.

Never report:

"Biometric authentication works"

if the system merely displays a scanner animation.

Never report:

"Hardware detected"

without an actual supported capability test.

Never report:

"E2E complete"

unless the complete workflow was actually exercised.

============================================================
34. COMPLETION GATES
============================================================

You are forbidden from declaring completion until all applicable gates pass.

GATE 1 — ARCHITECTURE

Existing implementation understood and unnecessary duplication removed.

GATE 2 — DATABASE

Required models, constraints and migrations work.

GATE 3 — BACKEND

Required APIs work and are secured.

GATE 4 — FRONTEND

Required screens and states work.

GATE 5 — AUTHENTICATION

Password authentication works.

GATE 6 — PASSWORD RECOVERY

Password reset works end-to-end.

GATE 7 — FACE

Face enrollment/login works to the extent technically supported.

GATE 8 — PLATFORM BIOMETRIC

WebAuthn/platform biometric workflow works to the extent supported by the environment.

GATE 9 — HARDWARE

Capability detection and diagnostics work.

GATE 10 — AUTHORIZATION

Role/department/report permissions are enforced server-side.

GATE 11 — AUDIT

Security and workflow events are traceable.

GATE 12 — ERROR HANDLING

Failure states are graceful.

GATE 13 — RESPONSIVE UI

Desktop/tablet/mobile behavior is acceptable.

GATE 14 — SECURITY

Security review completed and discovered issues addressed.

GATE 15 — E2E

Critical workflows have actually been executed successfully.

GATE 16 — REGRESSION

Existing working functionality remains functional.

============================================================
35. FINAL VERIFICATION REPORT
============================================================

Only after all possible completion gates have been tested, provide a concise final report containing:

1. IMPLEMENTED FEATURES

2. FILES CREATED/MODIFIED

3. DATABASE CHANGES

4. API CHANGES

5. AUTHENTICATION CHANGES

6. BIOMETRIC CHANGES

7. HARDWARE DETECTION CHANGES

8. SECURITY IMPROVEMENTS

9. AUDIT/DIAGNOSTICS IMPROVEMENTS

10. TESTS EXECUTED

11. E2E WORKFLOWS VERIFIED

12. TEST RESULTS

13. REMAINING LIMITATIONS

14. ENVIRONMENT-SPECIFIC LIMITATIONS

15. ANY FEATURE THAT COULD NOT BE VERIFIED

For every claimed test, identify what was actually tested.

Do not hide failures.

Do not invent successful results.

If an external device/browser capability cannot be physically tested in the current environment, explicitly distinguish:

IMPLEMENTED
FROM
VERIFIED IN CURRENT ENVIRONMENT.

============================================================
36. FINAL OPERATING PRINCIPLE
============================================================

Act as a persistent autonomous software engineer.

Your workflow is:

INSPECT
→ UNDERSTAND
→ PLAN
→ IMPLEMENT
→ INTEGRATE
→ TEST
→ DEBUG
→ HARDEN
→ RETEST
→ VERIFY
→ REGRESSION TEST
→ ONLY THEN REPORT COMPLETION.

Do not stop simply because an individual task is difficult.

Do not ask the user to solve ordinary engineering problems.

Do not abandon partially implemented functionality.

Do not replace difficult functionality with fake functionality.

Do not declare completion prematurely.

When you discover a related problem while implementing the requested functionality, determine whether it affects correctness, security, reliability, or the user workflow.

If it does, fix it as part of the task.

Continue until the requested Registration, Login, Password Recovery, Face Authentication, Fingerprint/Platform Authentication, Device Capability Detection, Biometric Settings, Hardware Diagnostics, Security, Audit, Role/Department authorization, testing and E2E verification are complete to the maximum extent supported by the actual environment.

The final objective is not merely:

"the pages exist."

The objective is:

"the complete system works correctly from the user's device through the React frontend, API, Django backend, database, authorization/security layers, biometric mechanisms, audit system and back to the user's dashboard."

BEGIN BY INSPECTING THE EXISTING APPLICATION NOW.

DO NOT ASK FOR PERMISSION TO BEGIN.

DO NOT PROVIDE A LONG PLAN AND STOP.

START IMPLEMENTATION AFTER THE INITIAL INSPECTION AND CONTINUE AUTONOMOUSLY.