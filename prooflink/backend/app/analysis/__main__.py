"""Try the engine from the terminal:  python -m app.analysis "your message here" """
import sys

from app.analysis import analyze

if len(sys.argv) < 2:
    sys.exit('Usage: python -m app.analysis "text or link to check"')

r = analyze(" ".join(sys.argv[1:]))
print(f"\n{r.risk_level.replace('_', ' ')}  |  score {r.risk_score}/100  |  confidence {int(r.confidence * 100)}%")
print(r.headline)
print("\n" + r.explanation)
print("\nSignals:")
for s in r.signals:
    print(f"  [{s.kind:9}] {s.label} (+{s.severity})  {s.matched[:2]}")
print("\nEntities:")
for e in r.entities:
    print(f"  {e.kind:12} {e.value}" + (f"   FLAGGED: {e.flag_reason}" if e.flagged else ""))
print("\nWhat to do:")
for a in r.recommended_actions:
    print(f"  - {a}")
if r.reassurances:
    print("\nReassuring:")
    for a in r.reassurances:
        print(f"  - {a}")
print("\nLimits:")
for a in r.limitations:
    print(f"  - {a}")
