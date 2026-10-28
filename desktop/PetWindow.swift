import Cocoa
import Darwin
import WebKit

final class PetWindow: NSWindow {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}

final class PetWebView: WKWebView {
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
}

final class DesktopPet: NSObject, NSApplicationDelegate, WKUIDelegate, WKScriptMessageHandler {
    var dragOrigin: NSPoint?
    let window = PetWindow(
        contentRect: NSRect(x: 0, y: 0, width: 168, height: 210),
        styleMask: [.borderless],
        backing: .buffered,
        defer: false
    )

    func applicationDidFinishLaunching(_ notification: Notification) {
        closeOtherPets()
        window.level = NSWindow.Level(rawValue: NSWindow.Level.normal.rawValue - 1)
        window.collectionBehavior = [.canJoinAllSpaces, .stationary]
        window.isOpaque = false
        window.backgroundColor = .clear
        window.hasShadow = false
        window.hidesOnDeactivate = false
        if let screen = NSScreen.main {
            let frame = screen.visibleFrame
            let size = window.frame.size
            window.setFrameOrigin(NSPoint(x: frame.maxX - size.width - 16, y: frame.midY))
        }
        let config = WKWebViewConfiguration()
        config.userContentController.add(self, name: "pet")
        let web = PetWebView(frame: window.contentView?.bounds ?? .zero, configuration: config)
        web.autoresizingMask = [.width, .height]
        web.setValue(false, forKey: "drawsBackground")
        web.uiDelegate = self
        web.load(URLRequest(url: petURL()))
        window.contentView = web
        window.orderBack(nil)
    }

    private func comeForward() {
        window.level = .floating
        window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        window.orderFrontRegardless()
    }

    private func stepBack() {
        window.level = NSWindow.Level(rawValue: NSWindow.Level.normal.rawValue - 1)
        window.collectionBehavior = [.canJoinAllSpaces, .stationary]
        window.orderBack(nil)
    }

    private func closeOtherPets() {
        let me = getpid()
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/usr/bin/pgrep")
        task.arguments = ["-f", "desktop-pet"]
        let pipe = Pipe()
        task.standardOutput = pipe
        try? task.run()
        task.waitUntilExit()
        let text = String(data: pipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
        for line in text.split(separator: "\n") {
            guard let pid = Int32(line), pid != me, pid > 0 else { continue }
            kill(pid, SIGTERM)
        }
    }

    private func petURL() -> URL {
        var ports: [Int] = []
        if CommandLine.arguments.count > 1, let port = Int(CommandLine.arguments[1]), port > 0 {
            ports.append(port)
        }
        for candidate in [3001, 3000] where !ports.contains(candidate) {
            ports.append(candidate)
        }
        for port in ports where notesServer(port) {
            return URL(string: "http://127.0.0.1:\(port)/pet")!
        }
        return URL(string: "http://127.0.0.1:\(ports.first ?? 3001)/pet")!
    }

    private func notesServer(_ port: Int) -> Bool {
        guard let url = URL(string: "http://127.0.0.1:\(port)/api/notes") else { return false }
        var request = URLRequest(url: url, timeoutInterval: 1)
        request.httpMethod = "GET"
        let gate = DispatchSemaphore(value: 0)
        var ok = false
        URLSession.shared.dataTask(with: request) { data, response, _ in
            if let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode),
               let data, let text = String(data: data, encoding: .utf8), text.contains("\"notes\"") {
                ok = true
            }
            gate.signal()
        }.resume()
        _ = gate.wait(timeout: .now() + 1.2)
        return ok
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
        } else if body == "show" {
            comeForward()
        } else if body == "rest" {
            stepBack()
        } else if body == "raise" {
            let running = NSRunningApplication.runningApplications(withBundleIdentifier: "local.mindbook.app")
            if let app = running.first {
                app.activate(options: [.activateAllWindows])
            } else {
                let home = FileManager.default.homeDirectoryForCurrentUser
                let app = home.appendingPathComponent("Applications/MindBook.app")
                NSWorkspace.shared.open(app)
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                NSApp.terminate(nil)
            }
        }
    }
}

let app = NSApplication.shared
let pet = DesktopPet()
app.setActivationPolicy(.accessory)
app.delegate = pet
app.run()
