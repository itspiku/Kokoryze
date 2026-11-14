"""Click-through tests of the running app in a real browser.

Start the backend (:8000) and frontend (:5173) first, then:
    pip install playwright
    python e2e/clickthrough.py
Uses the installed Microsoft Edge (no browser download). For Chrome, change channel to "chrome".
Claude replies are stubbed in the browser, so no API key is needed. Screenshots land in e2e/.
"""
import json
import urllib.request
from pathlib import Path

from playwright.sync_api import Route, expect, sync_playwright

OUT = Path(__file__).parent
BASE = "http://localhost:5173"
API = "http://127.0.0.1:8000"
results = []


def api(path, body=None, method=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method or ("POST" if data else "GET"),
                                 headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req).read())


def check(name, fn):
    try:
        fn()
        results.append((name, "PASS", ""))
    except Exception as e:  # noqa: BLE001
        results.append((name, "FAIL", str(e).splitlines()[0][:200]))


with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge")

    def page(w=1280, h=1000):
        ctx = b.new_context(viewport={"width": w, "height": h})
        ctx.add_init_script("localStorage.setItem('kokoryze.tod','afternoon')")
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        return pg, errs

    # 1. Activity loop: suggestion -> do it -> "did this help?" -> learner updates
    def activity_loop():
        api("/demo/reset", {})
        pg, errs = page()
        pg.goto(f"{BASE}/patient/ben")
        expect(pg.get_by_text("10-minute walk outside").first).to_be_visible()
        pg.get_by_role("button", name="Start").first.click()
        pg.get_by_role("button", name="Begin").click()
        pg.get_by_role("button", name="I'm done").click()
        pg.get_by_role("button", name="Not really").click()
        pg.get_by_role("button", name="Save").click()
        expect(pg.get_by_text("We'll suggest it less")).to_be_visible()
        pg.screenshot(path=str(OUT / "e2e_learned.png"))
        assert not errs, errs
    check("Activity: suggestion -> feedback -> learner updates", activity_loop)

    # 2. Quick-form check-in saves and returns home
    def form_checkin():
        pg, errs = page()
        pg.goto(f"{BASE}/patient/anna/checkin")
        expect(pg.get_by_role("tab", name="Quick form")).to_have_attribute("aria-selected", "true")
        pg.get_by_role("button", name="Save check-in").click()
        expect(pg.get_by_text("Thanks for checking in")).to_be_visible()
        assert not errs, errs
    check("Check-in: quick form saves", form_checkin)

    # 3. Chat check-in UI with stubbed Claude replies; saving goes to the real backend
    def chat_checkin():
        api("/demo/reset", {})
        pg, errs = page()
        replies = iter([
            {"reply": "Thanks for sharing. How's your energy been today?", "done": False, "crisis": False, "proposal": None},
            {"reply": "Got it, thank you Ben. Here's what I noted.", "done": True, "crisis": False,
             "proposal": {"mood": 4, "energy": 3, "anxiety": 5, "sleep_quality": 2, "notes": "Tired, slept badly."}},
        ])

        def handle(route: Route):
            if route.request.method == "GET":
                route.fulfill(json={"available": True, "opening": "Hi Ben 👋 How has today been for you so far?"})
            else:
                route.fulfill(json=next(replies))
        pg.route("**/api/patients/ben/checkin-chat", handle)
        pg.goto(f"{BASE}/patient/ben/checkin")
        expect(pg.get_by_text("How has today been")).to_be_visible()
        box = pg.get_by_label("Your message")
        box.fill("Pretty rough, slept badly")
        box.press("Enter")
        expect(pg.get_by_text("How's your energy been today?")).to_be_visible()
        box.fill("Very low energy")
        box.press("Enter")
        expect(pg.get_by_text("Here's what I understood")).to_be_visible(timeout=5000)
        pg.screenshot(path=str(OUT / "e2e_chat_confirm.png"))
        pg.get_by_role("button", name="Looks right, save").click()
        expect(pg.get_by_text("Thanks for checking in")).to_be_visible()
        today = api("/patients/ben/today")["today"]
        assert (today["mood"], today["energy"]) == (4, 3), today
        assert not errs, errs
    check("Check-in: chat -> confirm -> saved values", chat_checkin)

    # 4. Crisis in chat: real backend safety check (no AI involved) -> crisis screen + urgent
    def chat_crisis():
        api("/demo/reset", {})
        pg, errs = page()

        def handle(route: Route):
            if route.request.method == "GET":
                route.fulfill(json={"available": True, "opening": "Hi Anna 👋 How has today been for you so far?"})
            else:
                route.continue_()  # real backend
        pg.route("**/api/patients/anna/checkin-chat", handle)
        pg.goto(f"{BASE}/patient/anna/checkin")
        box = pg.get_by_label("Your message")
        box.fill("Honestly I don't want to live anymore")
        box.press("Enter")
        expect(pg.get_by_text("You're not alone")).to_be_visible(timeout=5000)
        status = next(x for x in api("/clinic/overview")["patients"] if x["id"] == "anna")["status"]
        assert status == "urgent", status
        assert not errs, errs
    check("Safety: crisis words in chat -> crisis screen + urgent", chat_crisis)

    # 5. Chat unavailable (no API key): tab disabled, form shown
    def chat_unavailable():
        pg, errs = page()
        pg.goto(f"{BASE}/patient/ben/checkin")
        expect(pg.get_by_role("tab", name="Chat")).to_be_disabled()
        expect(pg.get_by_text("turns on when the server has an Anthropic API key")).to_be_visible()
        assert not errs, errs
    check("Check-in: no API key -> chat disabled, form shown", chat_unavailable)

    # 6. Live clinician list: a crisis elsewhere shows up without reloading
    def live_clinic():
        api("/demo/reset", {})
        pg, errs = page()
        pg.goto(f"{BASE}/clinic")
        expect(pg.get_by_text("1", exact=True).first).to_be_visible()
        api("/patients/david/checkins", {"mood": 2, "energy": 2, "anxiety": 8, "notes": "I want to hurt myself"})
        row = pg.locator("tr", has_text="David L.")
        expect(row.get_by_text("Urgent: contact today")).to_be_visible(timeout=8000)
        assert not errs, errs
    check("Clinic: list updates live after a crisis check-in", live_clinic)

    # 7. Brain session: run (3x speed ~40 s), learner + clinician get the result
    def brain_session():
        api("/demo/reset", {})
        pg, errs = page()
        pg.goto(f"{BASE}/patient/anna/brain")
        pg.get_by_role("button", name="Box breathing").click()
        pg.get_by_role("button", name="Start session").click()
        expect(pg.get_by_text("Before: resting, eyes open")).to_be_visible(timeout=5000)
        expect(pg.get_by_text("During: box breathing")).to_be_visible(timeout=30000)
        expect(pg.get_by_text("Kokoryze learned")).to_be_visible(timeout=40000)
        pg.screenshot(path=str(OUT / "e2e_brain_done.png"), full_page=True)
        sessions = api("/clinic/patients/anna")["brain_sessions"]
        assert sessions and sessions[0]["title"] == "Box breathing", sessions
        assert not errs, errs
    check("Brain: session -> learner + clinician see the result", brain_session)

    # 8. Privacy toggle hides data from the clinician
    def privacy():
        api("/demo/reset", {})
        pg, errs = page()
        pg.goto(f"{BASE}/patient/ben/privacy")
        pg.get_by_text("Sleep", exact=True).click()
        pg.wait_for_timeout(500)
        keys = [s["key"] for s in api("/clinic/patients/ben")["series"]]
        assert "sleep_hours" not in keys, keys
        assert not errs, errs
    check("Privacy: toggling sleep hides it from the clinician", privacy)

    # 9. Reaction game: 5 taps -> stored
    def reaction():
        api("/demo/reset", {})
        pg, errs = page()
        pg.goto(f"{BASE}/patient/ben/game")
        zone = pg.get_by_role("button", name="Tap to start")
        zone.click()
        for i in range(5):
            pg.get_by_text("TAP!").wait_for(timeout=5000)
            pg.wait_for_timeout(250)  # human-like reaction; <120 ms is rejected as "too early"
            pg.get_by_text("TAP!").click()
            if i < 4:
                pg.get_by_text("tap for next").click()
        expect(pg.get_by_text("Today's median")).to_be_visible()
        assert api("/patients/ben/today")["today"]["reaction_ms"], "not stored"
        assert not errs, errs
    check("Reaction game: 5 rounds -> stored", reaction)

    b.close()

api("/demo/reset", {})
for name, status, msg in results:
    print(f"{status}  {name}  {msg}")
print(f"\n{sum(r[1] == 'PASS' for r in results)}/{len(results)} passed")
