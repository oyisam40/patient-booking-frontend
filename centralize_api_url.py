"""
centralize_api_url.py

Run this once from the root of your patient-booking-frontend repo:

    python3 centralize_api_url.py

What it does:
1. Creates frontend/static/js/config.js containing a single API_BASE_URL constant.
2. Scans every .html file in frontend/templates/ and replaces every hardcoded
   'http://127.0.0.1:8000' with a reference to API_BASE_URL instead — so when
   the real backend URL arrives, you only need to change it in ONE place
   (config.js) instead of hunting through every template.
3. Adds a <script> tag loading config.js to any template that needed the change,
   right before its closing </head> tag, so API_BASE_URL is defined before any
   other script on the page tries to use it.

Safe to re-run — files that don't reference 127.0.0.1:8000 are left untouched,
and files that already load config.js won't get a duplicate <script> tag.
"""

import re
import os

TEMPLATES_DIR = os.path.join("frontend", "templates")
STATIC_JS_DIR = os.path.join("frontend", "static", "js")
CONFIG_JS_PATH = os.path.join(STATIC_JS_DIR, "config.js")

CONFIG_JS_CONTENT = """// Central place for the backend API base URL.
// Update this ONE line when the backend team gives you the real URL —
// every template pulls from here instead of hardcoding it individually.
const API_BASE_URL = 'http://127.0.0.1:8000';
"""

SCRIPT_TAG = "    <script src=\"{% static 'js/config.js' %}\"></script>\n"


def main():
    if not os.path.isdir(TEMPLATES_DIR):
        print(f"Could not find {TEMPLATES_DIR} — run this from your repo root.")
        return

    os.makedirs(STATIC_JS_DIR, exist_ok=True)

    if os.path.exists(CONFIG_JS_PATH):
        print(f"Skipped (already exists): {CONFIG_JS_PATH}")
    else:
        with open(CONFIG_JS_PATH, "w") as f:
            f.write(CONFIG_JS_CONTENT)
        print(f"Created: {CONFIG_JS_PATH}")

    changed_files = []

    for filename in sorted(os.listdir(TEMPLATES_DIR)):
        if not filename.endswith(".html"):
            continue

        path = os.path.join(TEMPLATES_DIR, filename)

        with open(path, "r") as f:
            content = f.read()

        original = content

        # Template literals: `http://127.0.0.1:8000... -> `${API_BASE_URL}...
        content = re.sub(r"`http://127\.0\.0\.1:8000", "`${API_BASE_URL}", content)

        # Plain quoted strings: 'http://127.0.0.1:8000... -> API_BASE_URL + '...
        content = re.sub(r"'http://127\.0\.0\.1:8000", "API_BASE_URL + '", content)
        content = re.sub(r'"http://127\.0\.0\.1:8000', 'API_BASE_URL + "', content)

        if content != original:
            if "config.js" not in content and "</head>" in content:
                content = content.replace("</head>", SCRIPT_TAG + "</head>", 1)

            with open(path, "w") as f:
                f.write(content)

            changed_files.append(filename)

    print(f"\nUpdated {len(changed_files)} template(s):")
    for name in changed_files:
        print(f"  - {name}")

    if not changed_files:
        print("  (none needed changes)")


if __name__ == "__main__":
    main()
