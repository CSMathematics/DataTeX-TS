from playwright.sync_api import sync_playwright

def verify_settings():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})

        try:
            page.goto("http://localhost:1420")
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(2000)

            # Click gear icon
            gear_icon = page.locator(".fa-gear, .fa-cog").last
            if gear_icon.is_visible():
                gear_icon.click()
            else:
                print("Gear icon not found")
                return

            page.wait_for_timeout(1000)

            # Verify Build Settings
            tex_link = page.get_by_text("TeX Engine").first
            if tex_link.is_visible():
                tex_link.click()
                page.wait_for_timeout(500)

            # Verify Editor Settings
            editor_link = page.get_by_text("Editor", exact=True).first
            if editor_link.is_visible():
                editor_link.click()
                page.wait_for_timeout(500)

            # Use role to find the input specifically to avoid strict mode error
            font_input = page.get_by_role("textbox", name="Font Family").first
            if font_input.is_visible():
                font_input.click()
                page.wait_for_timeout(500)

            page.screenshot(path="verification_final.png")
            print("Verification Complete")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_settings()
