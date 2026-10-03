# PHASE 18 — LOGIN FORM PRODUCTION CLEANUP & EMPTY DEFAULT CREDENTIALS

## Executive Summary & Objectives
Transition the login form from a development demo state to an institutional production standard. Remove all hardcoded test accounts, drop the "Development Test Accounts Reference" selector button and collapsible card from the frontend UI, and ensure input fields default to empty with helpful guiding placeholders. Pre-seeded test accounts remain securely preserved in the database for automated tests and authorized sign-ins.

---

## 1. Problem Statement & Functional Requirements
1. **Pre-filled Credentials:** `LoginPage.tsx` previously initialized `email` to `'admin@oromiabank.com'` and `password` to `'password'`. This violates clean enterprise UI principles and interferes with real device acceptance tests where officers enter their own credentials.
2. **Development Accounts Dropdown:** A collapsible `<details>` element labeled "Development Test Accounts Reference" displayed role emails and quick-select buttons. This must be eliminated from the frontend completely.
3. **Database Preservation:** All seed accounts (`admin@oromiabank.com`, `abebe.kebede@oromiabank.com`, `chala.desta@oromiabank.com`, `auditor@oromiabank.com`) must remain active in the backend database/SSOT for automated testing and real verification.
4. **Guiding Placeholders:**
   - Email: `e.g. abebe.kebede@oromiabank.com`
   - Password: `Enter your institutional password`

---

## 2. Technical Modifications
- In `src/components/LoginPage.tsx`:
  - Change initial state: `const [email, setEmail] = useState('');`
  - Change initial state: `const [password, setPassword] = useState('');`
  - Add clear placeholders on input elements.
  - Remove the entire `<div className="pt-2 border-t border-slate-200 ...">` containing `<details>` and test account cards.
  - Preserve `handleResetSeedData` via administrative tooling if required, but remove developer quick-fill buttons from customer/officer view.
- In `src/tests/phase18-login-form-production-cleanup.test.ts`:
  - Assert that default form state is empty.
  - Assert that no test account selector exists in the rendered login DOM.
  - Assert that pre-seeded accounts in database authenticate correctly when entered manually.
