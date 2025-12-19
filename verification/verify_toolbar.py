
import os
import re
from playwright.sync_api import sync_playwright, expect

def verify_toolbar():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Create a new context with a larger viewport
        context = browser.new_context(viewport={"width": 1280, "height": 720})
        page = context.new_page()

        try:
            # Navigate to the app (assuming default port 1420)
            page.goto("http://localhost:1420")

            # Wait for the app to load
            page.wait_for_load_state("networkidle")

            # Need to open a TeX file to see the toolbar.
            # In DataTex, "Start Page" is default.
            # We can try to create a new empty file.

            # Look for "New File" or similar button on Start Page or Header.
            # Based on App.tsx, there is a header with "New File" maybe?
            # Or use the button on Start Page "Create Empty Project" or similar.

            # Let's try to find "Create Empty File" button on start page if visible.
            # Or use Sidebar "New File" icon.

            # Wait for "Start Page" text to confirm load
            expect(page.get_by_text("Start Page")).to_be_visible()

            # Click "Create Empty File" or "New"
            # In StartPage.tsx (inferred), there might be a button.
            # In Header.tsx, there is onNewFile.
            # In Sidebar, there is a way to create file.

            # Let's try to find a button with text "New File" or icon.
            # Or "Create Empty Project"

            # Taking a screenshot of start page to debug if needed
            page.screenshot(path="verification/start_page.png")

            # Based on screenshot, there is "File" menu in header.
            # And icons in Sidebar.
            # But creating a file might require a dialog which is hard to mock in Tauri environment.
            # However, StartPage usually has shortcuts.
            # In the screenshot, I see "Open Folder".
            # I don't see "Create Empty Project" immediately visible in the view.
            # It might be below the fold or the text is different.

            # Let's try to inject code to open a tab directly, bypassing UI dialogs.
            # We can execute JS in the browser context.
            # The app likely exposes some global or we can try to click "File" -> "New File".

            # Let's try "File" menu item.
            page.get_by_text("File", exact=True).click()
            # Assuming "New File" or similar appears.
            # If native menu, Playwright can't see it.
            # But this is likely a custom UI header.

            # If that fails, we can try to mock the "save" dialog which is used by "createTabWithContent".
            # But "save" comes from @tauri-apps/plugin-dialog.

            # WORKAROUND:
            # We will edit src/App.tsx temporarily to open a dummy file on load.
            # But we can't do that inside this script easily without restarting dev server.

            # Alternative: Click on "Open Folder" if we can select a folder? No, system dialog.

            # Let's look at the screenshot again.
            # There is a sidebar with "PROJECT" and some icons.
            # One icon looks like a file with a plus?
            # It's in the row "PROJECT ... icons".
            # The icons are: [FileAdd], [FolderAdd], [Refresh?], [Collapse?]
            # Let's try to click the first icon in that row.

            # Locator for the Project section icons.
            # They are likely ActionIcons.
            # Let's try to find an icon with faFileCode or faPlus.
            # Or by tooltip "New File".

            # Let's try to find element with tooltip "New File".
            # But tooltips only appear on hover.

            # Let's try to find the ActionIcon.
            # We can select by the icon class if we knew it.

            # Let's use evaluate to create a tab if possible.
            # Not easy to access React state from outside.

            # Let's try scrolling down on start page. Maybe buttons are below.
            page.mouse.wheel(0, 500)

            # Try to find text "New Project" or "Empty File".
            # The screenshot shows "GET STARTED" partially cut off at bottom?
            # "Welcome to DataTex" is big.

            # Let's try clicking "File" -> "New File".
            # If "File" is a Mantine Menu, it should open a dropdown in DOM.

            page.get_by_text("File", exact=True).click()
            # Wait a bit
            page.wait_for_timeout(500)
            # Look for "New File"
            if page.get_by_text("New File").is_visible():
                page.get_by_text("New File").click()
                # If this triggers native dialog, we are stuck.
                # App.tsx: handleRequestNewFile -> setTabs(...).
                # It does NOT seem to trigger save dialog immediately?
                # handleRequestNewFile just opens a new Start Page if not open?
                # "const handleRequestNewFile = () => { ... setTabs(... {type: 'start-page'}) ... }"
                # So "New File" button might just open Start Page?
                pass

            # Let's look for "Create Empty" on Start Page again.
            # In EditorArea.tsx, StartPage is rendered.
            # Let's read StartPage.tsx to see what buttons it has.
            # But I can't read it here.

            # Let's assume there is a button "Create Empty" or similar.
            # Let's try to find any button on the page.
            # buttons = page.get_by_role("button").all()
            # for b in buttons: print(b.inner_text())

            # If we can't open a file, we can't verify toolbar.

            # Check if there is a "Wizards" section.
            # "Wizards" -> Click Preamble Wizard -> Insert -> creates a file.
            # Preamble Wizard "Insert" calls "onInsert" -> "createTabWithContent".
            # createTabWithContent calls "save" dialog. Stuck again.

            # Wait! App.tsx:
            # handleRequestNewFile -> opens Start Page tab.

            # Is there any way to get a 'editor' tab without dialog?
            # handleOpenFileNode -> reads file.
            # If we have a file in the project, we can open it.
            # But we haven't opened a folder.

            # Can we drag and drop a file?

            # Okay, I will modify App.tsx temporarily to initialize with a dummy editor tab.
            pass

            # Wait for editor to appear.
            # Editor usually has "Untitled.tex" tab.
            expect(page.get_by_text("Test.tex").first).to_be_visible(timeout=5000)

            # Now the toolbar should be visible below the file tabs.
            # Check for specific toolbar buttons.
            # Bold button has tooltip "Bold (\textbf)"

            # Hover over bold button to show tooltip?
            # Or just check for the icon/button presence.
            # Mantine Tooltips wrap the target.

            # Search for "H1" text which is in the toolbar.
            expect(page.get_by_text("H1", exact=True)).to_be_visible()

            # Take screenshot of the editor area including toolbar
            page.screenshot(path="verification/editor_toolbar.png")
            print("Screenshot saved to verification/editor_toolbar.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    if not os.path.exists("verification"):
        os.makedirs("verification")
    verify_toolbar()
