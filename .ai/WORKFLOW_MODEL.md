# WORKFLOW & SUBMISSION STATE MACHINE MODEL
**Application**: Oromia Bank NBE Regulatory Reporting Platform  
**Engine**: `src/services/workflowEngine.ts`  
**Version**: 1.0.0  

---

## 1. State Machine Definitions

```
                     +---------------------------------------+
                     |                 DRAFT                 | <---------------+
                     +---------------------------------------+                 |
                                         |                                     |
                                         | (Maker Submits for 4-Eyes Review)   |
                                         v                                     |
                     +---------------------------------------+                 |
                     |            PENDING_CHECKER            |                 |
                     +---------------------------------------+                 |
                                    /         \                                |
             (Checker Approves)    /           \ (Checker Requests Changes)    |
                                  v             v                              |
        +----------------------------+   +----------------------------+        |
        |          APPROVED          |   |    CORRECTION_REQUIRED     | -------+
        +----------------------------+   +----------------------------+  (Maker Revises)
                      |
                      | (Maker Final NBE Transmission)
                      v
        +----------------------------+
        |          SENDING           |
        +----------------------------+
                /            \
  (NBE 200 OK) /              \ (NBE 4xx / 5xx / Timeout)
              v                v
+--------------------+   +--------------------+
|        SENT        |   |       FAILED       |
|    (IMMUTABLE)     |   +--------------------+
+--------------------+             |
                                   | (Maker Retries Delivery or Resets)
                                   v
                         [SENDING / CORRECTION]
```

---

## 2. Legal State Transitions

| Current Status | Target Status | Authorized Actor | Pre-Conditions | Audit Event |
|---|---|---|---|---|
| `DRAFT` | `PENDING_CHECKER` | `MAKER` | All required fields valid, formulas computed | `SUBMIT_TO_CHECKER` |
| `PENDING_CHECKER` | `APPROVED` | `CHECKER` | Checker department matches return department; Maker != Checker | `CHECKER_APPROVE` |
| `PENDING_CHECKER` | `CORRECTION_REQUIRED` | `CHECKER` | Detailed regulatory comment provided; Maker != Checker | `CHECKER_REQUEST_CORRECTION` |
| `PENDING_CHECKER` | `REJECTED` | `CHECKER` | Non-revisable return rejected with audit notes | `CHECKER_REJECT` |
| `CORRECTION_REQUIRED`| `PENDING_CHECKER` | `MAKER` | Figures updated, re-validated cleanly | `RESUBMIT_TO_CHECKER` |
| `APPROVED` | `SENDING` | `MAKER` | Only Maker can transmit approved report | `MAKER_FINAL_NBE_SUBMISSION` |
| `SENDING` | `SENT` | `SYSTEM / ADAPTER`| NBE Gateway returns HTTP 200 with receipt number | `DELIVER_TO_NBE_SUCCESS` |
| `SENDING` | `FAILED` | `SYSTEM / ADAPTER`| NBE Gateway returns 4xx/5xx or timeout after retries | `DELIVER_TO_NBE_FAILURE` |
| `FAILED` | `SENDING` | `MAKER` | Retry attempt initiated by Maker | `RETRY_NBE_DELIVERY` |
| `SENT` | *NONE* | *NONE* | **Terminal & Immutable** - Cannot be modified | `AUDIT_SEALED` |

---

## 3. Conflict of Interest Protection
- Every transition verifies: `if (targetStatus in ['APPROVED', 'REJECTED', 'CORRECTION_REQUIRED'] && user.id === submission.makerId) throw Error`.
- Prevents any user from acting as both preparer and approver on the same regulatory return.
