# Apply after the render finishes (director-system.ts is loaded by the running app).
# The street walk is gone: its film shots put the camera outside, under the floating room.
# Keep the room shot through that stretch instead.
p = 'src/systems/director-system.ts'
s = open(p, encoding='utf8').read()
a = '''    } else if (tt < TOUR.street) {
      if (head) this.aim(head.clone().addScaledVector(this.toward(head, seat), 2.2).setY(1.45), head);
    } else if (tt < TOUR.clouds) {
      // Walking the street: a tracking shot ahead of him, then low, looking up at the towers.
      const w = WorldSpots.walker;
      // Both shots stay over the sidewalk, clear of the cabs.
      if (tt < TOUR.streetLow) this.aim(w.clone().addScaledVector(f.along, 3.4).addScaledVector(f.out, 0.5).setY(w.y + 1.55), w.clone().setY(w.y + 1.15));
      else this.aim(w.clone().addScaledVector(f.along, 4.5).addScaledVector(f.out, 0.6).setY(w.y + 0.45), w.clone().setY(w.y + 2.6));
    } else if'''
b = '''    } else if (tt < TOUR.clouds) {
      // In the room with him (the street walk is gone; this stretch is cut from the film).
      if (head) this.aim(this.inRoom(head.clone().addScaledVector(this.toward(head, seat), 2.2).setY(1.45)), head);
    } else if'''
assert s.count(a) == 1
s = s.replace(a, b, 1)
open(p, 'w', encoding='utf8').write(s)
print('street shot removed')
