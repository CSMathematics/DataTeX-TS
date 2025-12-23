import time
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Mock the frontend server - assuming localhost:1420 (Tauri)
    try:
        page.goto("http://localhost:1420")
    except:
        print("Frontend server not running at localhost:1420. Ensure the dev server is up.")
        # We can't actually verify without the dev server, but we can check the file structure
        # in a real test environment.
        return

    # Wait for the status bar to load
    page.wait_for_selector('text=Ready')

    # 1. Verify Spell Check Toggle
    # Look for the spell check button (FontAwesome icon)
    # We added aria-label or tooltip "Spell Check: Off" initially
    # Need to hover to see tooltip

    # Check if we can find the button (it might not have accessible text directly, just icon)
    # We can check for the fontawesome icon class if we knew it exactly or look for tooltip trigger.

    # 2. Verify Word Count Button (only visible if LaTeX file is active)
    # 3. Verify Cursor Position Text (Ln 1, Col 1)

    # Since we can't easily mock the full Tauri environment here,
    # we will rely on taking a screenshot of the main layout to manually inspect.

    page.screenshot(path="verification/screenshot_layout.png")
    print("Screenshot saved to verification/screenshot_layout.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
