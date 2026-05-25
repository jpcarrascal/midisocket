# TODO

## AmbSynth - Deferred Refactor Plan (keep current behavior for now)

Status: Deferred by decision on 2026-05-25.

Goal: Evaluate moving from per-touch voice node creation to a persistent audio graph architecture for better retrigger smoothness and lower allocation churn.

### Why defer
- Current implementation is working on desktop and iPhone after unlock-flow fixes.
- Priority is stability over architectural refactor.

### Proposed approach (future)
1. Keep one persistent audio graph after unlock:
   - output gain/compressor
   - filter
   - LFO + LFO depth gain
   - envelope gain
2. Keep noise source always running (gated by envelope), or replace with AudioWorklet noise source.
3. Convert touch lifecycle to envelope triggering only:
   - touch start: attack ramp
   - touch end: release ramp
4. Keep X/Y mapping logic unchanged (only parameter updates).
5. Keep existing unlock overlay behavior unchanged.

### Pros to validate in refactor
- Lower node allocation/GC churn during repeated touches.
- Smoother fast retrigger behavior.
- Simpler runtime state once graph is persistent.

### Risks to test
- Clicks/pops from envelope scheduling edge cases.
- Stale modulation state between touches.
- iPhone unlock regressions.

### Acceptance checklist
- One-tap unlock still reliable on iPhone.
- No audible clicks on rapid repeated touches.
- Equal or better responsiveness vs current build.
- Same functional mapping:
  - Y => filter frequency range
  - X => modulation frequency + amount

### Suggested implementation order
1. Introduce feature flag:
   - CONFIG.audio.usePersistentGraph (default false)
2. Implement persistent-graph path behind flag.
3. A/B test both paths on desktop + iPhone.
4. Flip default only after manual validation.
