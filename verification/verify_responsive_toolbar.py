
import os
import re
from playwright.sync_api import sync_playwright, expect

def verify_responsive_toolbar():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Create a new context with a small viewport to trigger responsive behavior
        context = browser.new_context(viewport={"width": 600, "height": 720})
        page = context.new_page()

        try:
            # Navigate to the app (assuming default port 1420)
            page.goto("http://localhost:1420")

            # Wait for the app to load
            page.wait_for_load_state("networkidle")

            # Wait for editor to appear.
            expect(page.get_by_text("Test.tex").first).to_be_visible(timeout=5000)

            # Wait for toolbar calculation
            page.wait_for_timeout(1000)

            # Since viewport is small (600px), some items should be hidden and "More" button visible.
            # "More" button uses ellipsis-v icon.
            # FontAwesome icon might not be selectable by text easily.
            # We used ActionIcon with faEllipsisV.

            # Let's take a screenshot first.
            page.screenshot(path="verification/responsive_toolbar_small.png")
            print("Screenshot saved to verification/responsive_toolbar_small.png")

            # Check if we can find the Menu Target (ellipsis vertical)
            # It's an ActionIcon, likely a button.
            # We can try to find by role button.

            # Try to resize to large width and check if everything is visible.
            page.set_viewport_size({"width": 1280, "height": 720})
            page.wait_for_timeout(1000)
            page.screenshot(path="verification/responsive_toolbar_large.png")
            print("Screenshot saved to verification/responsive_toolbar_large.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error_responsive.png")
        finally:
            browser.close()

if __name__ == "__main__":
    if not os.path.exists("verification"):
        os.makedirs("verification")
    verify_responsive_toolbar()
