# Testing Checklist - VR Color Circle

## A. Functional Tests
- [ ] Start game in Easy mode.
- [ ] Start game in Hard mode.
- [ ] Place correct color into correct slot -> accepted.
- [ ] Place wrong color -> rejected and play wrong SFX.
- [ ] Complete all colors in Level 1 -> unlock Level 2.
- [ ] Complete all colors in Level 2 -> unlock Level 3.
- [ ] Complete all colors in Level 3 -> victory state.
- [ ] Hard mode timer reaches 0 -> fail state.

## B. Audio Tests
- [ ] Background music loops.
- [ ] Pick SFX plays on grab.
- [ ] Correct/Wrong SFX plays correctly.
- [ ] Win/Lose SFX plays at end state.

## C. VR Interaction Tests
- [ ] Grab object is stable and smooth.
- [ ] Snap position is accurate on slot.
- [ ] No accidental trigger spam when object enters collider.

## D. Performance Tests
- [ ] Stable frame time in headset.
- [ ] No major stutter during grab/drop.
- [ ] Scene stays within performance budget.

## E. Regression
- [ ] Re-test all levels after script changes.
- [ ] Re-test all audio events after scene changes.
