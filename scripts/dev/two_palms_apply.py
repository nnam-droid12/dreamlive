# Apply after the render finishes (these files are loaded by the running app).
# Gifts land on BOTH open palms held together; both hands lower to set it on the floor.
def edit(p, pairs):
    s = open(p, encoding='utf8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (p, a[:80], s.count(a))
        s = s.replace(a, b, 1)
    open(p, 'w', encoding='utf8').write(s)

P = 'src/systems/catch-system.ts'
edit(P, [
    ("  private cup = new Vector3();\n",
     "  private cup = new Vector3();\n  private other = new Vector3();\n  private otherCup = new Vector3();\n"),
    # Flying: steer to both palms together (their midpoint), else one open palm.
    ("      // Steer the landing toward an open palm, if one is held out.\n      const palm = this.openPalm();\n      if (palm) {\n        this.hand.fromArray(palm.getVectorView(HandGestureState, 'palmCenter'));\n        this.hand.y += 0.08;",
     "      // Steer the landing toward both open palms held together (or one open palm).\n      const palm = this.openPalm();\n      if (this.bothPalms(true) || palm) {\n        if (!this.bothPalms(true)) this.hand.fromArray(palm!.getVectorView(HandGestureState, 'palmCenter'));\n        this.hand.y += 0.08;"),
    ("'Lower your hand to set the gift on the floor.'", "'Lower your hands to set the gift on the floor.'"),
    # Held: rests across both palms while they are together; else on the holding hand.
    ("      if (h && !lost) {\n        this.hand.fromArray(h.getVectorView(HandGestureState, 'palmCenter'));\n        this.cup.fromArray(h.getVectorView(HandGestureState, 'palmNormal'));\n        o.position",
     "      if (this.bothPalms(false)) {\n        o.position.copy(this.hand).addScaledVector(this.cup, 0.06);\n        o.rotation.y += delta * 0.6;\n      } else if (h && !lost) {\n        this.hand.fromArray(h.getVectorView(HandGestureState, 'palmCenter'));\n        this.cup.fromArray(h.getVectorView(HandGestureState, 'palmNormal'));\n        o.position"),
    ("  /** A tracked hand held open, palm up. */",
     "  /**\n   * Both hands tracked and held together (palms within 30 cm); `this.hand` = the\n   * point between the palms, `this.cup` = their average normal. With `palmsUp`,\n   * both must also be palm up.\n   */\n"
     "  private bothPalms(palmsUp: boolean): boolean {\n"
     "    let n = 0;\n"
     "    for (const h of this.queries.hands.entities) {\n"
     "      if (!h.getValue(HandGestureState, 'tracked')) return false;\n"
     "      if (palmsUp && !h.getValue(HandGestureState, 'palmUp')) return false;\n"
     "      const p = n === 0 ? this.hand : this.other;\n"
     "      const c = n === 0 ? this.cup : this.otherCup;\n"
     "      p.fromArray(h.getVectorView(HandGestureState, 'palmCenter'));\n"
     "      c.fromArray(h.getVectorView(HandGestureState, 'palmNormal'));\n"
     "      if (++n === 2) break;\n"
     "    }\n"
     "    if (n < 2 || this.hand.distanceTo(this.other) > 0.3) return false;\n"
     "    this.hand.add(this.other).multiplyScalar(0.5);\n"
     "    this.cup.add(this.otherCup).normalize();\n"
     "    return true;\n"
     "  }\n\n"
     "  /** A tracked hand held open, palm up. */"),
])

# The film: both palms out together, open and palm up; once the gift rests a moment, both lower to set it down.
edit('src/systems/director-system.ts', [
    ("      // One gift at a time: the right palm held up for it; once it rests there a moment, the hand lowers to set it on the floor.\n"
     "      const lower = GiftHold.holding && GiftHold.holdFor > 1.4;\n"
     "      right = { at: H_TMP.r.set(0.12, lower ? -0.8 : -0.2, lower ? -0.3 : -0.4), rot: Q_PALM_UP, pose: 'open', pinch: 0 };",
     "      // One gift at a time: both palms held out together, open and up, for it; once it rests\n"
     "      // there a moment, both hands lower together to set it on the floor.\n"
     "      const lower = GiftHold.holding && GiftHold.holdFor > 1.4;\n"
     "      const y = lower ? -0.8 : -0.22;\n"
     "      const z = lower ? -0.3 : -0.4;\n"
     "      left = { at: H_TMP.l.set(-0.055, y, z), rot: Q_PALM_UP, pose: 'open', pinch: 0 };\n"
     "      right = { at: H_TMP.r.set(0.055, y, z), rot: Q_PALM_UP, pose: 'open', pinch: 0 };"),
])
print('two palms applied')
