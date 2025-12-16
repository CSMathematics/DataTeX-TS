from playwright.sync_api import sync_playwright

def verify_preamble_wizard():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 720})
        page = context.new_page()

        # Navigate to the app
        print("Navigating to http://localhost:1420")
        try:
            page.goto("http://localhost:1420", timeout=10000)
        except:
            print("Failed to load page")
            return

        # Wait for the app to load
        page.wait_for_timeout(2000)

        print("Clicking Wizards sidebar icon")
        try:
             page.get_by_label("Wizards").click()
        except:
             print("Could not find by label 'Wizards', trying alternate method...")
             page.locator(".mantine-Stack-root > .mantine-ActionIcon-root").nth(3).click()

        page.wait_for_timeout(500)

        # Now "Preamble Wizard" button should be visible in the side panel.
        print("Clicking Preamble Wizard button")
        page.get_by_text("Preamble Wizard").click()

        # Wait for wizard to appear (it renders in the main area)
        page.wait_for_timeout(1000)

        # Switch to "Packages" tab
        print("Switching to Packages tab")
        page.get_by_text("Packages").click()
        page.wait_for_timeout(500)

        # Verify new packages are present
        if page.get_by_text("Mathematics & Science").is_visible():
            print("Found 'Mathematics & Science' group")
        else:
            print("Missing 'Mathematics & Science' group")

        # Check for specific new packages
        packages_to_check = ["Siunitx", "Multirow", "Tabularx", "Multicol", "Titlesec", "Microtype", "Csquotes", "Cleveref", "Listings", "Todonotes"]
        for pkg in packages_to_check:
             if page.get_by_label(pkg).is_visible():
                 print(f"Found checkbox for {pkg}")
                 # Toggle it to see if code updates
                 page.get_by_label(pkg).check()
             else:
                 print(f"Missing checkbox for {pkg}")

        # Switch to Code view to verify generation
        print("Switching to Code view")
        # Use get_by_role to avoid ambiguity with "References & Code" text
        page.get_by_role("button", name="Code").click()
        page.wait_for_timeout(500)

        # The 'code' tag might be inside Mantine Code component.
        # Let's try locating by text content or look at the structure.
        # In PreambleWizard.tsx:
        # <Code block ...>{generatedCode}</Code>
        # Mantine Code component renders a `pre > code` structure usually.

        print("Getting code content")
        try:
            content = page.locator("code").text_content(timeout=5000)
        except:
            print("Could not find 'code' tag directly. Looking for pre tag.")
            content = page.locator("pre").text_content()

        print("Generated Code Snippet (Partial):")
        print(content[:500]) # Print first 500 chars

        # Take screenshot
        print("Taking screenshot")
        page.screenshot(path="verification/preamble_wizard.png", full_page=True)

        browser.close()

if __name__ == "__main__":
    verify_preamble_wizard()
