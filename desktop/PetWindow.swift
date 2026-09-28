import Cocoa
import WebKit

final class DesktopPet: NSObject, NSApplicationDelegate, WKUIDelegate, WKScriptMessageHandler {
    var dragOrigin: NSPoint?
    let window = NSWindow(
        contentRect: NSRect(x: 0, y: 0, width: 168, height: 210),
        styleMask: [.borderless],
        backing: .buffered,
        defer: false
    )

    func applicationDidFinishLaunching(_ notification: Notification) {
        window.level = .floating
        window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        window.isOpaque = false
        window.backgroundColor = .clear
        window.hasShadow = false
        window.hidesOnDeactivate = false
        if let screen = NSScreen.main {
            let frame = screen.visibleFrame
            window.setFrameOrigin(NSPoint(x: frame.maxX - window.frame.width - 24, y: frame.minY + 24))
        }
        let config = WKWebViewConfiguration()
        config.userContentController.add(self, name: "pet")
        let web = WKWebView(frame: window.contentView?.bounds ?? .zero, configuration: config)
        web.autoresizingMask = [.width, .height]
        web.setValue(false, forKey: "drawsBackground")
        web.uiDelegate = self
        web.load(URLRequest(url: URL(string: "http://127.0.0.1:3000/pet")!))
        window.contentView = web
        window.orderFrontRegardless()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? String else { return }
        if body == "close" {
            NSApp.terminate(nil)
        } else if body == "drag-start" {
            dragOrigin = window.frame.origin
        } else if body.hasPrefix("move:"), let start = dragOrigin {
            let parts = body.dropFirst(5).split(separator: ",").map(String.init)
            let dx = CGFloat(Double(parts.first ?? "0") ?? 0)
            let dy = CGFloat(Double(parts.dropFirst().first ?? "0") ?? 0)
            window.setFrameOrigin(NSPoint(x: start.x + dx, y: start.y - dy))
        } else if body.hasPrefix("size:") {
            let parts = body.dropFirst(5).split(separator: ",").map(String.init)
            let width = min(440, max(120, CGFloat(Double(parts.first ?? "146") ?? 146)))
            let height = min(480, max(120, CGFloat(Double(parts.dropFirst().first ?? "136") ?? 136)))
            var frame = window.frame
            let right = frame.maxX
            let bottom = frame.minY
            frame.size = NSSize(width: width, height: height)
            frame.origin.x = right - width
            frame.origin.y = bottom
            window.setFrame(frame, display: true)
        } else if body == "raise" {
            let running = NSRunningApplication.runningApplications(withBundleIdentifier: "local.mindbook.app")
            if let app = running.first {
                app.activate(options: [.activateAllWindows])
            } else {
                let home = FileManager.default.homeDirectoryForCurrentUser
                let app = home.appendingPathComponent("Applications/MindBook.app")
                NSWorkspace.shared.open(app)
            }
        }
    }
}

let app = NSApplication.shared
let pet = DesktopPet()
app.setActivationPolicy(.accessory)
app.delegate = pet
app.run()
