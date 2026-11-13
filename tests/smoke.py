"""Smoke tests ScènePlan : démarrage, sélection, cadrage, aimantation et modes."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

def standalone():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    html = html.replace('<link rel="stylesheet" href="./style.css">',
        "<style>" + (ROOT / "style.css").read_text(encoding="utf-8") + "</style>")
    for filename in ("arrus-import.js", "app.js"):
        html = html.replace(f'<script src="./{filename}"></script>',
            "<script>" + (ROOT / filename).read_text(encoding="utf-8") + "</script>")
    return html

def main():
    html = standalone()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True, executable_path=os.environ.get("CHROMIUM_PATH") or None,
            args=["--no-sandbox"])
        for phone in (False, True):
            context = browser.new_context(
                viewport={"width":390 if phone else 1440,"height":844 if phone else 900},
                is_mobile=phone,has_touch=phone)
            page = context.new_page()
            page.set_default_timeout(8000)
            errors = []
            page.on("pageerror", lambda err: errors.append(str(err)))
            page.set_content(html,wait_until="load")
            page.wait_for_function(
                'S.proj!==null && document.querySelectorAll("g.dancer-point").length===8')
            assert not errors, f"Erreur JS démarrage : {errors}"
            assert page.locator("#magnetToggle").inner_text().strip().endswith("Libre")
            scene = page.locator("#stageSVG")
            before = scene.bounding_box()
            page.locator("g.dancer-point").first.click(force=True)
            assert page.evaluate("S.selected.size") == 1
            after = scene.bounding_box()
            assert abs(before["width"]-after["width"]) < 1
            assert abs(before["height"]-after["height"]) < 1
            page.locator("g.dancer-point").first.click(force=True)
            assert page.evaluate("S.selected.size") == 0
            page.locator("#magnetToggle").click()
            assert page.evaluate("S.proj.stage.snap") is True
            page.locator("#magnetToggle").click()
            assert page.evaluate("S.proj.stage.snap") is False
            page.locator('[data-act="layoutSync"]').first.click()
            assert page.evaluate("S.layoutMode") == "sync"
            page.locator('[data-act="layoutPlacement"]').first.click()
            assert page.evaluate("S.layoutMode") == "placement"
            assert not errors, f"Erreur JS après interaction : {errors}"
            print("OK", "mobile" if phone else "ordinateur")
            context.close()
        browser.close()

if __name__ == "__main__":
    main()
