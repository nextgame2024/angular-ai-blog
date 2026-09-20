# Conversation changes awaiting publication

September 20, 2026. These changes accompany the local startup improvement.
No deployment or live provider configuration update was performed during this work.

## Changes

- Premium conversation creation explicitly requests Tavus multilingual mode.
  Shared instructions follow the user's requested language while preserving
  exact booking details and identifiers.
- Essential and Professional keep microphone input enabled during playback so
  the existing OpenAI server VAD interruption setting can work. Professional
  also interrupts HeyGen playback and discards buffered audio. Browser echo
  cancellation remains enabled.
- Cancelled OpenAI text responses are not replayed through HeyGen. Interrupted
  tool requests still return their result to the same conversation, but do not
  explicitly start another answer. Results from an old connection are ignored.
- Tavus tools use silent execution instead of generated filler. Photo/panel
  display tools update context without generating another answer; substantive
  results still generate a response. Duplicate call IDs and stale conversation
  results are guarded. Actual live answer repetition has not been reproduced
  locally, so these defenses still need a voice check.
- A spinner and task/status text cover startup and answer preparation. Waiting
  on an answer suppresses inactivity prompts. Student rule comparisons and live
  verification can use their relevant tool directly without a preliminary
  knowledge lookup.
- Below the small-screen breakpoint the footer is one compact line:
  `Sophia Ai - © <current year>. All rights reserved.` Desktop retains its credit.

## Validation and release checks

29 Sophia browser tests and 51 runtime tests pass. Both production builds pass.
The frontend build reports bundle/font budget, CommonJS and missing PrimeIcons
stylesheet warnings; these are not resolved by this change.

Before declaring the voice issues resolved in production, start a fresh session
on each plan and check:

1. Ask in English, switch to Spanish, then switch back.
2. Interrupt a long answer and confirm only the new question is answered.
   Check both headphones and device speakers for unwanted self-interruption.
3. In Premium, search properties, enlarge/close a photo and ask a student-rule
   question. Confirm useful results are spoken once without filler repetition.
4. During a slow lookup, confirm the spinner remains visible and no idle prompt
   starts. Finish and restart; old results must not appear in the new session.
5. Check the footer at 320–430 px widths and confirm desktop still shows its credit.

Provider connection and inference delays remain; no measured live latency
reduction is claimed. Tavus tool configuration is applied by the backend's
existing provider setup when sessions are created after deployment. Check its
setup logs and test a fresh session after setup completes.

References: [OpenAI interruption behavior](https://developers.openai.com/api/docs/guides/realtime-conversations#interruption-and-truncation),
[Tavus conversation properties](https://docs.tavus.io/api-reference/conversations/create-conversation),
[Tavus tool behavior](https://docs.tavus.io/api-reference/tools/create-tool).
