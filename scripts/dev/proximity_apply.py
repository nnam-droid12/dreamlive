# Apply after the render finishes (tuning.ts and index.ts are loaded by the running app).
def edit(p, pairs):
    s = open(p, encoding='utf8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (p, a[:70], s.count(a))
        s = s.replace(a, b, 1)
    open(p, 'w', encoding='utf8').write(s)


edit('src/config/tuning.ts', [(
    "  performance: {",
    "  /** Proximity passthrough in the fully virtual worlds: the world fades as you move this far (m) from your spot, gone by this far; the same for a hand reaching out from your head; fade speed. */\n"
    "  proximity: {\n    headStart: 0.3,\n    headFull: 0.55,\n    handStart: 0.62,\n    handFull: 0.8,\n    fadeRate: 5,\n  },\n\n  performance: {",
)])
edit('src/index.ts', [
    ("import { QualitySystem } from './systems/quality-system.js';",
     "import { QualitySystem } from './systems/quality-system.js';\nimport { ProximityPassthroughSystem } from './systems/proximity-passthrough-system.js';"),
    ("    .registerSystem(PanelSystem);", "    .registerSystem(PanelSystem)\n    .registerSystem(ProximityPassthroughSystem);"),
])
print('proximity passthrough registered')
