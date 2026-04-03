# Performance Guide for VR Color Circle

## 1) Rendering
- Use single-pass instanced rendering when available.
- Keep materials simple; avoid heavy real-time effects.
- Prefer baked lighting for static geometry.
- Minimize transparent objects in front of camera.
- Clamp device pixel ratio for stable frame time.

## 2) Geometry and Assets
- Keep polygon count low for interactive objects.
- Use compressed textures with suitable resolution.
- Reuse prefabs and materials to improve batching.

## 3) Physics
- Use simple colliders where possible.
- Keep Rigidbody interpolation only where needed.
- Avoid unnecessary continuous collision on all objects.

## 4) Scripts
- Avoid expensive logic in Update when not needed.
- Cache references instead of repeated Find calls.
- Use events for state transitions.
- Keep raycasting targets small and filtered.

## 5) Audio
- Compress audio clips appropriately.
- Limit number of simultaneous SFX.

## 6) Target Metrics
- Target stable 72 FPS or above.
- Avoid spikes in CPU/GPU frame time.
