# BACKEND ARCHITECTURE & DJANGO AUDIT NOTICE
**Application**: Oromia Bank NBE Regulatory Reporting Platform  
**Architecture Reality**: Node.js v22 + Express Full-Stack (`server.ts`)  
**Audit Finding**: **NO DJANGO BACKEND EXISTS.**

---

## 1. Architectural Clarification
While certain legacy development prompts made passing reference to a "React + Django" stack, inspection of the authoritative application source confirms:
- **No Python code, files, or packages exist** in this repository (0 `.py` files, no `manage.py`, no `Pipfile`, no `requirements.txt`).
- The entire backend is built with **Node.js, Express, and TypeScript**, executed via `server.ts` on port 3000.
- All regulatory endpoints, authentication routes, biometric verification flows, and NBE simulator services are natively implemented in Express.

## 2. Server Runtime Specifications
- **File**: `server.ts`
- **Runtime**: Node.js v22 (with native type stripping / `tsx`)
- **Port**: 3000
- **Development**: Mounts Vite middlewares (`appType: 'spa'`) for seamless hot reloading.
- **Production**: Serves compiled static bundle from `dist/`.

## 3. Storage Layer
- **Server Storage**: High-performance in-memory Map structures (`submissionService`, `userService`, `auditService`, `nbeSimulator`).
- **Client Storage**: Native browser IndexedDB (`OromiaBank_NBE_Regulatory_DB`) for offline draft resilience and field examiner visits.
