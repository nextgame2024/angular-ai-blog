# Sophia startup

Start requests microphone permission immediately while creating the runtime
session. Essential and Professional reuse that stream for Realtime; Premium
passes its audio track to Daily. Microphone permission is never requested on page
load. Runtime health warm-up still runs on page entry.

The previous order was runtime session → microphone permission/capture → provider
connection. The new order is runtime session + microphone permission/capture in
parallel → provider connection. This removes the server wait before the prompt
and overlaps those stages. It does not eliminate provider/WebRTC connection time;
no fixed number of seconds is promised.

Microphone tracks and any created runtime session are released when permission,
connection or startup fails, and when the page is destroyed. Late results from a
cancelled startup are cleaned up rather than connected.

Browser console timing entries (`[Sophia startup]`) distinguish microphone-ready,
runtime-session-created and Realtime-connected time. The Realtime entry starts at
voice connection; the kiosk entries start at the Start click. Compare the same
browser, plan, network and saved-permission state when measuring before/after.

Validation: 21 Sophia browser tests passed, including startup on all three plans,
parallel capture/session creation, microphone denial, late failure/navigation
cleanup and the existing student/property checks. A real user's browser timing
still needs to be measured after deployment.
