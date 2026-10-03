# OB FACE ID SIGN-IN CAMERA FAILURE — DEEP DIAGNOSTIC AND FIX

You are continuing development of the OB/NBE Regulatory Reporting application.

A real Android tablet test has exposed a reproducible Face ID authentication problem.

DEVICE TEST RESULT
------------------
Device:
Samsung Galaxy Tab A6 Android tablet

Observed behavior:

1. Face ID ENROLLMENT works successfully.
2. The tablet camera opens successfully during enrollment.
3. The user can capture their face.
4. Face enrollment completes successfully and the face credential/template is stored.
5. The SAME tablet/browser/application is then used for Face ID SIGN-IN.
6. The Face ID sign-in dialog opens.
7. Camera UI appears and reports "Camera Ready".
8. User attempts face verification/capture.
9. Verification fails.
10. UI reports:

   "Browser is not allowed to access the camera"

This strongly suggests an implementation inconsistency between the enrollment camera flow and the sign-in camera flow.

DO NOT assume this is a device problem.
DO NOT simply change the error message.
DO NOT fake successful verification.
DO NOT bypass face authentication.
DO NOT weaken authentication security.

Your task is to inspect the actual implementation and find the root cause.

============================================================
PHASE 1 — TRACE THE COMPLETE CAMERA IMPLEMENTATION
============================================================

Search the entire repository for all camera/media access code.

Find every occurrence of:

- navigator.mediaDevices
- getUserMedia
- MediaStream
- MediaStreamTrack
- video.srcObject
- enumerateDevices
- facingMode
- camera permission logic
- Permissions API
- camera permission state
- face enrollment camera service
- face sign-in camera service
- face capture functions
- face verification functions
- mobile camera logic
- webcam logic
- camera cleanup
- stream.stop()
- track.stop()
- camera initialization
- camera retry
- camera reset
- camera error handling

Create a clear internal map of:

A. Enrollment camera path
B. Sign-in camera path
C. Shared camera utilities/services
D. Face capture implementation
E. Face verification implementation

Do not modify code until this comparison is understood.

============================================================
PHASE 2 — COMPARE ENROLLMENT VS SIGN-IN
============================================================

Determine whether enrollment and sign-in use:

- the same camera service
- the same getUserMedia constraints
- the same permission logic
- the same stream lifecycle
- the same video element lifecycle
- the same camera selection logic
- the same facingMode
- the same retry logic
- the same error handling
- the same cleanup behavior

Identify every difference.

Pay particular attention to whether:

ENROLLMENT:

getUserMedia()
    ↓
MediaStream
    ↓
video.srcObject
    ↓
capture frame
    ↓
enroll

while SIGN-IN does:

getUserMedia()
    ↓
MediaStream
    ↓
video.srcObject
    ↓
Verify button
    ↓
SECOND getUserMedia()
    ↓
failure

If sign-in requests a second camera stream unnecessarily, fix it.

============================================================
PHASE 3 — SINGLE ACTIVE CAMERA STREAM
============================================================

Implement a robust shared camera lifecycle.

The preferred architecture is:

START CAMERA
    ↓
check browser capability
    ↓
check secure context
    ↓
check permission state where supported
    ↓
request camera permission
    ↓
obtain MediaStream
    ↓
store active stream
    ↓
attach stream to video element
    ↓
wait for video readiness
    ↓
show Camera Ready
    ↓
user presses Capture/Verify
    ↓
capture frame from EXISTING active stream
    ↓
perform face detection/quality/liveness processing
    ↓
send protected verification request
    ↓
receive server verification result
    ↓
authenticate or reject
    ↓
stop stream only when camera workflow ends

Do NOT request getUserMedia() again merely because the user presses
"Verify Face to Sign In".

============================================================
PHASE 4 — CAMERA STATE MACHINE
============================================================

Implement explicit camera states.

Example:

idle
requesting_permission
permission_denied
permission_blocked
stream_starting
stream_ready
capturing
processing
verified
verification_failed
camera_unavailable
camera_busy
unsupported
stopped

The UI must reflect the actual state.

Never display:

"Camera Ready"

unless a usable MediaStream actually exists and the video element
has successfully received it.

Never display:

"Camera Ready"

merely because the browser capability was detected.

============================================================
PHASE 5 — DISTINGUISH CAMERA ERRORS
============================================================

Do not convert every camera error into:

"Browser is not allowed to access the camera"

Inspect the actual DOMException.

Handle at minimum:

NotAllowedError
NotFoundError
NotReadableError
OverconstrainedError
SecurityError
AbortError
TypeError

For each error record:

- error.name
- error.message
- current URL/origin
- secure context status
- permission state if available
- whether an active stream exists
- number of active video tracks
- selected camera/device if available
- current camera state

Do NOT expose sensitive information to the user.

Use developer diagnostics/logging separately.

Example mapping:

NotAllowedError:
"Camera permission is blocked or the browser is not allowing this
page to access the camera."

NotFoundError:
"No compatible camera was found."

NotReadableError:
"The camera is currently unavailable or being used by another
application."

OverconstrainedError:
"The requested camera configuration is not supported."

SecurityError:
"Camera access has been disabled by the browser or environment."

============================================================
PHASE 6 — CHECK PERMISSIONS API
============================================================

Where supported, inspect:

navigator.permissions.query({ name: "camera" })

Handle:

granted
prompt
denied

Do NOT assume Permissions API support exists on every browser.

If unsupported, gracefully continue with getUserMedia().

Important:

permission state is diagnostic information only.

The actual getUserMedia() result remains authoritative.

============================================================
PHASE 7 — CHECK SECURE CONTEXT
============================================================

Before camera access verify:

window.isSecureContext

and:

navigator.mediaDevices

If the application requires HTTPS, do not silently attempt camera
access from an insecure origin.

Show an appropriate diagnostic state.

Remember that getUserMedia requires a secure context and browser
permission.

============================================================
PHASE 8 — CHECK EMBEDDED/IFRAME ENVIRONMENT
============================================================

Determine whether the OB application or Face ID component is running
inside an iframe, preview frame, sandbox, or embedded environment.

Inspect:

document.location.origin
window.top !== window.self

and relevant iframe permissions.

If camera access occurs inside an iframe, verify that the embedding
context permits camera access.

Check:

Permissions-Policy

and iframe:

allow="camera"

where applicable.

Do not weaken security globally.

Only permit the required origin/context.

============================================================
PHASE 9 — CHECK CAMERA CONSTRAINTS
============================================================

Compare enrollment and sign-in constraints.

Avoid unnecessarily strict constraints such as:

exact width
exact height
exact deviceId
exact facingMode

unless they are actually required.

Prefer tolerant mobile-compatible constraints such as:

video: {
    facingMode: { ideal: "user" },
    width: { ideal: 1280 },
    height: { ideal: 720 }
}

Use graceful fallback if constraints fail.

For example:

1. preferred front camera
2. generic video camera
3. available camera fallback

Do not require a specific device ID unless the user explicitly
selected that camera.

============================================================
PHASE 10 — CAMERA STREAM OWNERSHIP
============================================================

Identify who owns the MediaStream.

There must be one authoritative owner.

Prevent:

- duplicate streams
- stale streams
- race conditions
- camera initialization twice
- cleanup from one component killing the stream used by another
- React effect cleanup accidentally stopping a newly-created stream
- modal unmount/remount causing camera races

If React is used, carefully inspect:

useEffect
useRef
component mount/unmount
modal open/close
state changes
StrictMode behavior
async cleanup

A stale asynchronous camera request must not overwrite a newer
camera state.

============================================================
PHASE 11 — CAPTURE MUST USE THE ACTIVE VIDEO STREAM
============================================================

The Verify Face button must capture from the already active video.

Preferred architecture:

activeStream
    ↓
videoElement.srcObject
    ↓
videoElement.readyState
    ↓
canvas.drawImage(videoElement,...)
    ↓
face frame/feature processing

Do NOT restart the camera simply to capture a frame.

Before capture verify:

video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA

and:

video.videoWidth > 0
video.videoHeight > 0

If not ready, wait for:

loadedmetadata
canplay
playing

or equivalent controlled readiness.

============================================================
PHASE 12 — FACE VERIFICATION MUST REMAIN SERVER-AUTHORITATIVE
============================================================

Do not fix the camera problem by moving authentication entirely
to the client.

Do not accept:

"face detected"

as authentication.

The system must distinguish:

face detected
face quality acceptable
liveness/anti-spoof checks
face feature extracted
identity match
authentication success

The backend remains authoritative.

The client only captures and submits the required protected
verification material.

============================================================
PHASE 13 — DO NOT STORE RAW BIOMETRIC DATA UNNECESSARILY
============================================================

Preserve the existing OB biometric security architecture.

Do not introduce:

- raw permanent face photographs
- raw biometric logs
- browser localStorage biometric templates
- plaintext biometric templates
- client-side authentication bypass

Use the existing protected biometric service/storage design.

============================================================
PHASE 14 — FIX THE UI STATE
============================================================

The current UI says:

"Camera Ready"

and then:

"Verification Not Completed"

with:

"Browser is not allowed to access the camera"

This is misleading if the camera stream was already successfully
opened.

Replace generic messaging with state-specific messaging.

Examples:

CAMERA READY
"Camera is ready. Position your face inside the frame."

CAPTURING
"Capturing face..."

PROCESSING
"Verifying your identity..."

PERMISSION DENIED
"Camera permission is blocked. Allow camera access for this site,
then retry."

CAMERA BUSY
"The camera is currently unavailable. Close other applications
using the camera and retry."

VERIFICATION FAILED
"Face verification was not successful. Please try again."

Do not call a face-match failure a camera-permission failure.

============================================================
PHASE 15 — LOGGING / DIAGNOSTICS
============================================================

Add structured development diagnostics.

When camera initialization or capture fails, log:

{
  stage,
  errorName,
  errorMessage,
  isSecureContext,
  mediaDevicesAvailable,
  permissionState,
  hasActiveStream,
  activeVideoTrackCount,
  videoReadyState,
  videoWidth,
  videoHeight,
  origin,
  isEmbedded
}

Do not log:

- raw face images
- face templates
- passwords
- authentication secrets
- WebAuthn private keys
- sensitive biometric payloads

============================================================
PHASE 16 — TEST THE ACTUAL ANDROID SCENARIO
============================================================

After implementing the fix, test this exact sequence:

TEST A
Samsung Galaxy Tab A6
Android
same browser
same OB origin

1. Sign in with password.
2. Open Face ID enrollment.
3. Enroll face.
4. Confirm enrollment success.
5. Log out.
6. Open Face ID sign-in.
7. Start camera.
8. Confirm camera preview.
9. Press Verify Face.
10. Confirm capture uses the existing stream.
11. Confirm face verification request is sent.
12. Confirm successful authentication.
13. Confirm correct role dashboard opens.

TEST B

Repeat Face ID sign-in without re-enrollment.

TEST C

Reload browser and sign in again.

TEST D

Deny camera permission.

Confirm graceful permission-denied behavior.

TEST E

Reset browser/site camera permission.

Repeat enrollment and sign-in.

TEST F

Open another application that uses the camera.

Attempt OB verification.

Confirm a camera-busy error is correctly reported.

TEST G

Use front-camera selection.

TEST H

Use another supported browser if available.

============================================================
PHASE 17 — REGRESSION TEST ENROLLMENT
============================================================

The fix must NOT break:

- Face enrollment
- Face reset
- Password login
- Fingerprint/WebAuthn authentication
- Registration
- user identity binding
- role routing
- audit logging
- biometric security
- session creation
- logout

Face ID and Fingerprint authentication must remain independent.

============================================================
PHASE 18 — SEARCH FOR DUPLICATE IMPLEMENTATIONS
============================================================

Do not merely patch the visible component.

Search for duplicate camera implementations.

If enrollment has:

CameraService A

and sign-in has:

CameraService B

determine whether they should be consolidated into a shared,
well-tested camera service.

There must be one authoritative browser-camera lifecycle implementation
unless there is a documented technical reason otherwise.

============================================================
PHASE 19 — NO FAKE SUCCESS
============================================================

Never implement:

if camera fails:
    pretend verification succeeded

Never bypass biometric verification.

Never automatically fall back to password after a failed biometric
attempt unless the existing authentication policy explicitly provides
that option and the user deliberately chooses it.

============================================================
PHASE 20 — FINAL REPORT
============================================================

After fixing the implementation, provide:

1. Root cause found
2. Exact files changed
3. Camera lifecycle changes
4. Permission handling changes
5. Sign-in/enrollment differences discovered
6. Whether duplicate getUserMedia calls existed
7. Whether iframe/Permissions Policy was involved
8. Whether camera constraints caused the problem
9. Tests performed
10. Android tablet test result
11. Enrollment result
12. Sign-in result
13. Regression test result
14. Any remaining environment-specific limitations

Clearly distinguish:

IMPLEMENTED
VERIFIED
NOT VERIFIED
REQUIRES REAL DEVICE TEST

Do not claim hardware verification unless the actual hardware test
was performed.