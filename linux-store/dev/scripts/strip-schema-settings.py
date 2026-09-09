import json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parents[2] / "theme"


def strip_schema_settings(rel, ids):
    p = ROOT / rel
    s = p.read_text(encoding="utf-8")
    m = re.search(r"\{% schema %\}(.*?)\{% endschema %\}", s, re.S)
    sch = json.loads(m.group(1))
    sch["settings"] = [x for x in sch.get("settings", []) if x.get("id") not in ids]
    s = s[: m.start(1)] + "\n" + json.dumps(sch, ensure_ascii=False, indent=2) + "\n" + s[m.end(1):]
    p.write_text(s, encoding="utf-8")


strip_schema_settings("sections/campaign.liquid", {"show_mascot", "mascot"})
strip_schema_settings("sections/newsletter.liquid", {"show_mascot"})
strip_schema_settings("sections/main-collection.liquid", {"show_mascot"})
p = ROOT / "templates/collection.json"
d = json.loads(p.read_text(encoding="utf-8"))
d["sections"]["main"]["settings"].pop("show_mascot", None)
p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("ok")
