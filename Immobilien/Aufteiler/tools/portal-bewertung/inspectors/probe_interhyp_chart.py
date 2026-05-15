"""Probe: liest Highcharts-Daten vom Wertentwicklung-Tab von Interhyp.

Lauf:
    .venv\\Scripts\\python.exe inspectors/probe_interhyp_chart.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

THIS_DIR = Path(__file__).resolve().parent
PROJ_ROOT = THIS_DIR.parent
if str(PROJ_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJ_ROOT))

from playwright.sync_api import sync_playwright

from core.datensatz import from_summary
from portals.interhyp.portal import InterhypPortal
from core.portal_base import RunConfig


def main() -> int:
    d = from_summary(
        strasse="Prosperstraße",
        hausnr="59",
        plz="45357",
        ort="Essen",
        baujahr=1965,
        zustand="gut",
        ausstattung="normal",
        anzahl_we=4,
        gesamtwohnflaeche_qm=320.0,
        gesamtzimmer=12.0,
        anzahl_garagen=2,
        anzahl_aussenstellplaetze=2,
    )
    portal = InterhypPortal()
    cfg = RunConfig(headless=True, verbose=False)

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        ctx = browser.new_context(
            locale="de-DE",
            timezone_id="Europe/Berlin",
            viewport={"width": 1440, "height": 900},
        )
        page = ctx.new_page()

        print(">>> Lade Interhyp-URL…", file=sys.stderr, flush=True)
        page.goto(portal.START_URL, wait_until="domcontentloaded")
        page.wait_for_timeout(2_500)

        # Cookie-Banner
        for s in portal.COOKIE_ACCEPT_CANDIDATES:
            try:
                loc = page.locator(s).first
                if loc.count() > 0 and loc.is_visible():
                    loc.click(timeout=2_000)
                    print(f">>> Cookies via {s!r}", file=sys.stderr, flush=True)
                    break
            except Exception:
                continue

        print(">>> fill_form (Wizard durchklicken)…", file=sys.stderr, flush=True)
        portal.fill_form(page, d, cfg)
        page.wait_for_timeout(3_000)

        # Klicke auf Wertentwicklung-Tab (Multi-Strategie fuer Material-UI Tabs)
        print(">>> Klicke Wertentwicklung-Tab…", file=sys.stderr, flush=True)
        clicked = False
        for s in [
            '[role="tab"]:has-text("Wertentwicklung")',
            'button[role="tab"]:has-text("Wertentwicklung")',
            'a[role="tab"]:has-text("Wertentwicklung")',
            'a:has-text("Wertentwicklung")',
            'button:has-text("Wertentwicklung")',
            'label:has-text("Wertentwicklung")',
            'div:has-text("Wertentwicklung"):not(:has(div))',
        ]:
            try:
                loc = page.locator(s).first
                if loc.count() > 0 and loc.is_visible():
                    loc.click(timeout=3_000)
                    print(f">>>   Tab geklickt via {s!r}", file=sys.stderr, flush=True)
                    clicked = True
                    break
            except Exception:
                continue
        if not clicked:
            print(">>> Tab-Klick FAIL fuer alle Strategien.", file=sys.stderr, flush=True)
        page.wait_for_timeout(4_000)

        # Window-Variablen-Scan nach Chart-Namen
        chart_names = page.evaluate(
            """
            () => {
                const keys = Object.keys(window).filter(k =>
                    /chart|highchart|chartjs|recharts|d3/i.test(k)
                );
                return keys.slice(0, 30);
            }
            """
        )
        print(f">>> window-Keys mit 'chart': {chart_names}", file=sys.stderr, flush=True)

        # SVG-Path-Daten (Chart-Linien)
        svg_paths = page.evaluate(
            """
            () => {
                const paths = Array.from(document.querySelectorAll('path'));
                return paths
                    .filter(p => {
                        const d = p.getAttribute('d') || '';
                        return d.length > 100 && (d.match(/[ML]\\s*\\d/g) || []).length > 3;
                    })
                    .slice(0, 10)
                    .map(p => ({
                        cls: p.getAttribute('class') || '',
                        stroke: p.getAttribute('stroke') || '',
                        d_short: (p.getAttribute('d') || '').slice(0, 200),
                        d_len: (p.getAttribute('d') || '').length,
                    }));
            }
            """
        )
        print(f">>> SVG-Paths gefunden: {len(svg_paths)}", file=sys.stderr, flush=True)
        for i, p in enumerate(svg_paths):
            print(f"  Path {i}: cls={p['cls']!r} stroke={p['stroke']!r}", file=sys.stderr, flush=True)

        Path("runs").mkdir(exist_ok=True)
        Path("runs/interhyp_chart_probe.json").write_text(
            json.dumps({"chart_names": chart_names, "svg_paths": svg_paths}, indent=2),
            encoding="utf-8",
        )

        # Pfade NUR aus dem aktuellen sichtbaren Tab-Panel
        from portals.interhyp.parsers import classify_trend_richtung, parse_svg_path_points
        full_paths = page.evaluate(
            """
            () => {
                // Strategie 1: Suche role="tabpanel" das sichtbar ist
                let containers = Array.from(document.querySelectorAll('[role="tabpanel"]'))
                    .filter(p => !p.hidden && window.getComputedStyle(p).display !== 'none');
                // Strategie 2: Suche jeden div, der den Heading 'Marktwert 2016' o.ae. enthaelt
                //              (Wertentwicklung-Kachel)
                if (containers.length === 0) {
                    const heading = Array.from(document.querySelectorAll('*'))
                        .find(el => /Marktwert\\s+\\d{4}/.test(el.textContent || ''));
                    if (heading) {
                        // Klettere zu naechstem section/div mit SVGs
                        let el = heading;
                        for (let i = 0; i < 10; i++) {
                            el = el.parentElement;
                            if (!el) break;
                            if (el.querySelector('svg path.highcharts-graph')) {
                                containers = [el];
                                break;
                            }
                        }
                    }
                }
                const found_paths = containers.length > 0
                    ? containers.flatMap(c => Array.from(c.querySelectorAll('path.highcharts-graph')))
                    : Array.from(document.querySelectorAll('path.highcharts-graph'));
                return found_paths
                    .map(p => ({
                        cls: p.getAttribute('class') || '',
                        stroke: p.getAttribute('stroke') || '',
                        d: p.getAttribute('d') || '',
                    }))
                    .filter(o => o.d.length > 100);
            }
            """
        )
        print(f">>> Anzahl 'highcharts-graph'-Pfade: {len(full_paths)}", file=sys.stderr, flush=True)
        for i, p in enumerate(full_paths):
            pts = parse_svg_path_points(p["d"])
            if len(pts) < 4:
                continue
            n = len(pts)
            last_20pct = pts[-max(2, n // 5):]
            y_values = [y for _, y in pts]
            y_range = max(y_values) - min(y_values)
            richtung = classify_trend_richtung(pts)
            print(
                f"  Pfad {i} stroke={p['stroke']!r} n_pts={n} y_range={y_range:.1f} "
                f"last20%_y_start={last_20pct[0][1]:.1f} last20%_y_end={last_20pct[-1][1]:.1f} "
                f"-> richtung={richtung!r}",
                file=sys.stderr, flush=True,
            )

        # Highcharts-Check (alt)
        print(">>> Highcharts-Check…", file=sys.stderr, flush=True)
        has_hc = page.evaluate("() => typeof Highcharts !== 'undefined'")
        print(f">>>   Highcharts global verfuegbar: {has_hc}", file=sys.stderr, flush=True)
        if has_hc:
            count = page.evaluate("() => (Highcharts.charts || []).length")
            print(f">>>   Anzahl Charts: {count}", file=sys.stderr, flush=True)

            data = page.evaluate(
                """
                () => {
                    const charts = (Highcharts.charts || []).filter(c => c && c.series);
                    return charts.map((c, i) => ({
                        index: i,
                        series_count: c.series.length,
                        series: c.series.map(s => ({
                            name: s.name,
                            n_points: (s.processedYData || []).length,
                            last_10_y: (s.processedYData || []).slice(-10),
                            last_10_x: (s.processedXData || []).slice(-10),
                        })),
                    }));
                }
                """
            )
            Path("runs").mkdir(exist_ok=True)
            out_path = Path("runs/interhyp_chart_probe.json")
            out_path.write_text(
                json.dumps(data, default=str, indent=2), encoding="utf-8"
            )
            print(f">>>   Dump: {out_path}", file=sys.stderr, flush=True)
            print(json.dumps(data, default=str, indent=2)[:3000], file=sys.stderr, flush=True)
        else:
            print(">>>   Highcharts NICHT verfuegbar — Plan B noetig.",
                  file=sys.stderr, flush=True)

        browser.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
