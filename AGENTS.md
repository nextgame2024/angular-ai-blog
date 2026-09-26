# Sophia implementation pointer

For Sophia realtime/Admin work, read `../backend/docs/sophia-realtime-codex-implementation-plan.v2.1.json` and `../backend/docs/sophia/implementation-progress.json` first. The architecture JSON is a reported baseline, not implementation evidence.

Keep the real-estate demo working. New Sophia Admin UI belongs in a protected, lazy-loaded `src/app/sophia-admin` area and must rely on server-enforced permissions; navigation visibility is presentation only. Keep student-agency imports out of new core/Admin roots, and keep concrete AI provider selection behind approved server profiles/adapters. Record tests actually run and do not activate live external side effects without explicit authorization.
