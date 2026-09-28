import Cocoa
import WebKit

final class MindBookApp: NSObject, NSApplicationDelegate, WKUIDelegate, WKNavigationDelegate, NSWindowDelegate {
    private var mainWindow: NSWindow?
    private var petWindow: NSWindow?
    private var server: Process?
    private var startedServer = false
    private let session = URLSession(configuration: .ephemeral)

    func applicationDidFinishLaunching(_ notification: Notification) {
        installMenu()
        let window = makeWindow(title: "MindBook", size: NSSize(width: 1180, height: 780))
        window.center()
        window.isReleasedWhenClosed = false
        window.delegate = self
        mainWindow = window
        showStatus("正在打开 MindBook…", on: window)
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        DispatchQueue.global(qos: .userInitiated).async {
            let ready = self.ensureServer()
            DispatchQueue.main.async {
                self.clearStatus(on: window)
                if ready {
                    self.attachWeb(to: window, path: "/")
                } else {
                    self.showStatus("本地服务没有起来。日志在项目里的 data/mindbook-app.log", on: window)
                }
            }
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    func applicationWillTerminate(_ notification: Notification) {
        guard startedServer, let server, server.isRunning else { return }
        server.terminate()
    }

    func windowWillClose(_ notification: Notification) {
        guard let window = notification.object as? NSWindow, window == petWindow else { return }
        petWindow = nil
    }

    @objc func showPet(_ sender: Any?) {
        if petWindow == nil {
            let window = makeWindow(title: "伙伴", size: NSSize(width: 300, height: 420))
            window.level = .floating
            window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
            window.isReleasedWhenClosed = false
            window.delegate = self
            if let screen = NSScreen.main {
                let frame = screen.visibleFrame
                window.setFrameOrigin(NSPoint(x: frame.maxX - 340, y: frame.minY + 72))
            }
            attachWeb(to: window, path: "/pet")
            petWindow = window
        }
        petWindow?.makeKeyAndOrderFront(nil)
    }

    private func installMenu() {
        let menubar = NSMenu()
        let appItem = NSMenuItem()
        menubar.addItem(appItem)
        let appMenu = NSMenu()
        appMenu.addItem(NSMenuItem(title: "显示伙伴", action: #selector(showPet(_:)), keyEquivalent: "p"))
        appMenu.addItem(.separator())
        appMenu.addItem(NSMenuItem(title: "退出 MindBook", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
        appItem.submenu = appMenu
        NSApp.mainMenu = menubar
    }

    private func makeWindow(title: String, size: NSSize) -> NSWindow {
        let window = NSWindow(
            contentRect: NSRect(origin: .zero, size: size),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = title
        window.minSize = NSSize(width: 720, height: 480)
        window.backgroundColor = NSColor(calibratedRed: 0.90, green: 0.89, blue: 0.86, alpha: 1)
        return window
    }

    private func attachWeb(to window: NSWindow, path: String) {
        let web = WKWebView(frame: window.contentView?.bounds ?? .zero)
        web.autoresizingMask = [.width, .height]
        web.uiDelegate = self
        web.navigationDelegate = self
        window.contentView = web
        if let url = URL(string: "http://127.0.0.1:3000" + path) {
            web.load(URLRequest(url: url))
        }
    }

    private func showStatus(_ text: String, on window: NSWindow) {
        let label = NSTextField(wrappingLabelWithString: text)
        label.frame = NSRect(x: 36, y: (window.contentView?.bounds.midY ?? 200) - 20, width: 520, height: 48)
        label.textColor = NSColor(calibratedWhite: 0.25, alpha: 1)
        label.tag = 42
        window.contentView?.viewWithTag(42)?.removeFromSuperview()
        window.contentView?.addSubview(label)
    }

    private func clearStatus(on window: NSWindow) {
        window.contentView?.viewWithTag(42)?.removeFromSuperview()
    }

    private func projectRoot() -> String {
        let url = Bundle.main.bundleURL.appendingPathComponent("Contents/Resources/project-root")
        let text = (try? String(contentsOf: url, encoding: .utf8)) ?? ""
        return text.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func serverUp() -> Bool {
        guard let url = URL(string: "http://127.0.0.1:3000") else { return false }
        var request = URLRequest(url: url, timeoutInterval: 1.5)
        request.httpMethod = "GET"
        let gate = DispatchSemaphore(value: 0)
        var ok = false
        session.dataTask(with: request) { _, response, _ in
            if let http = response as? HTTPURLResponse {
                ok = (200..<500).contains(http.statusCode)
            }
            gate.signal()
        }.resume()
        _ = gate.wait(timeout: .now() + 2)
        return ok
    }

    private func ensureServer() -> Bool {
        if serverUp() { return true }
        guard startServer() else { return false }
        let deadline = Date().addingTimeInterval(45)
        while Date() < deadline {
            if serverUp() { return true }
            Thread.sleep(forTimeInterval: 0.4)
        }
        return false
    }

    private func startServer() -> Bool {
        let root = projectRoot()
        let node = root + "/.tools/node/bin/node"
        let next = root + "/node_modules/next/dist/bin/next"
        guard FileManager.default.isExecutableFile(atPath: node),
              FileManager.default.fileExists(atPath: next) else {
            return false
        }
        let logURL = URL(fileURLWithPath: root + "/data/mindbook-app.log")
        try? FileManager.default.createDirectory(at: URL(fileURLWithPath: root + "/data"), withIntermediateDirectories: true)
        FileManager.default.createFile(atPath: logURL.path, contents: nil)
        guard let log = try? FileHandle(forWritingTo: logURL) else { return false }
        let proc = Process()
        proc.executableURL = URL(fileURLWithPath: node)
        proc.arguments = [next, "dev", "--port", "3000"]
        proc.currentDirectoryURL = URL(fileURLWithPath: root)
        var env = ProcessInfo.processInfo.environment
        let nodeBin = (node as NSString).deletingLastPathComponent
        env["PATH"] = nodeBin + ":" + (env["PATH"] ?? "")
        proc.environment = env
        proc.standardOutput = log
        proc.standardError = log
        do {
            try proc.run()
        } catch {
            return false
        }
        server = proc
        startedServer = true
        return true
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        if navigationAction.targetFrame == nil, let url = navigationAction.request.url {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if let url = navigationAction.request.url {
            NSWorkspace.shared.open(url)
        }
        return nil
    }
}

let app = NSApplication.shared
let delegate = MindBookApp()
app.setActivationPolicy(.regular)
app.delegate = delegate
app.run()
