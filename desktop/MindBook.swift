import Cocoa
import WebKit

final class NoteWebView: WKWebView {
    private var handledPasteCount = -1

    func pasteIntoNote() {
        if insertScreenshot() { return }
        super.perform(Selector(("paste:")), with: nil)
    }

    override func performKeyEquivalent(with event: NSEvent) -> Bool {
        let flags = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
        let key = event.charactersIgnoringModifiers?.lowercased()
        if event.type == .keyDown, flags == .command, key == "v", insertScreenshot() {
            return true
        }
        return super.performKeyEquivalent(with: event)
    }

    private func insertScreenshot() -> Bool {
        let board = NSPasteboard.general
        if board.changeCount == handledPasteCount { return true }
        guard let png = screenshotPNG(board) else { return false }
        handledPasteCount = board.changeCount
        upload(png)
        return true
    }

    private func screenshotPNG(_ board: NSPasteboard) -> Data? {
        let text = (board.string(forType: .string) ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if !text.isEmpty { return nil }
        if let png = board.data(forType: .png), !png.isEmpty { return png }
        if let tiff = board.data(forType: .tiff),
           let rep = NSBitmapImageRep(data: tiff),
           let png = rep.representation(using: .png, properties: [:]),
           !png.isEmpty {
            return png
        }
        guard let image = board.readObjects(forClasses: [NSImage.self], options: nil)?.first as? NSImage,
              let tiff = image.tiffRepresentation,
              let rep = NSBitmapImageRep(data: tiff),
              let png = rep.representation(using: .png, properties: [:]),
              !png.isEmpty else {
            return nil
        }
        return png
    }

    private func upload(_ png: Data) {
        guard let page = url, let host = page.host, let scheme = page.scheme else { return }
        var origin = "\(scheme)://\(host)"
        if let port = page.port { origin += ":\(port)" }
        guard let endpoint = URL(string: origin + "/api/media") else { return }
        let boundary = "MindBook\(UUID().uuidString.replacingOccurrences(of: "-", with: ""))"
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        var body = Data()
        body.append(Data("--\(boundary)\r\n".utf8))
        body.append(Data("Content-Disposition: form-data; name=\"file\"; filename=\"screenshot.png\"\r\n".utf8))
        body.append(Data("Content-Type: image/png\r\n\r\n".utf8))
        body.append(png)
        body.append(Data("\r\n--\(boundary)--\r\n".utf8))
        request.httpBody = body
        URLSession.shared.dataTask(with: request) { [weak self] data, _, _ in
            guard let data,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let mediaURL = json["url"] as? String else {
                DispatchQueue.main.async { self?.handledPasteCount = -1 }
                return
            }
            let quoted = mediaURL.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "'", with: "\\'")
            DispatchQueue.main.async {
                self?.evaluateJavaScript("window.mindbookInsertImage && window.mindbookInsertImage('\(quoted)')")
            }
        }.resume()
    }
}

final class MindBookApp: NSObject, NSApplicationDelegate, WKUIDelegate, WKNavigationDelegate, NSWindowDelegate {
    private var mainWindow: NSWindow?
    private var petWindow: NSWindow?
    private var server: Process?
    private var startedServer = false
    private let session = URLSession(configuration: .ephemeral)
    private var port = 3001

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

        let editItem = NSMenuItem()
        menubar.addItem(editItem)
        let editMenu = NSMenu(title: "编辑")
        editMenu.addItem(editAction("撤销", Selector(("undo:")), "z", [.command]))
        editMenu.addItem(editAction("重做", Selector(("redo:")), "z", [.command, .shift]))
        editMenu.addItem(.separator())
        editMenu.addItem(editAction("剪切", #selector(NSText.cut(_:)), "x", [.command]))
        editMenu.addItem(editAction("拷贝", #selector(NSText.copy(_:)), "c", [.command]))
        let paste = NSMenuItem(title: "粘贴", action: #selector(pasteIntoNote(_:)), keyEquivalent: "v")
        paste.target = self
        editMenu.addItem(paste)
        editMenu.addItem(editAction("全选", #selector(NSText.selectAll(_:)), "a", [.command]))
        editItem.submenu = editMenu
        NSApp.mainMenu = menubar
    }

    private func editAction(_ title: String, _ action: Selector, _ key: String, _ modifiers: NSEvent.ModifierFlags) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: action, keyEquivalent: key)
        if !modifiers.isEmpty {
            item.keyEquivalentModifierMask = modifiers
        }
        item.target = nil
        return item
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

    @objc func pasteIntoNote(_ sender: Any?) {
        guard let web = NSApp.keyWindow?.contentView as? NoteWebView else { return }
        web.pasteIntoNote()
    }

    func validateMenuItem(_ menuItem: NSMenuItem) -> Bool {
        true
    }

    private func attachWeb(to window: NSWindow, path: String) {
        let web = NoteWebView(frame: window.contentView?.bounds ?? .zero)
        web.autoresizingMask = [.width, .height]
        web.uiDelegate = self
        web.navigationDelegate = self
        window.contentView = web
        if let url = URL(string: "http://127.0.0.1:\(port)" + path) {
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

    private func mindBookPort(_ candidate: Int) -> Bool {
        guard let url = URL(string: "http://127.0.0.1:\(candidate)/api/notes") else { return false }
        var request = URLRequest(url: url, timeoutInterval: 1.5)
        request.httpMethod = "GET"
        let gate = DispatchSemaphore(value: 0)
        var ok = false
        session.dataTask(with: request) { data, response, _ in
            if let http = response as? HTTPURLResponse, http.statusCode == 200,
               let data, let text = String(data: data, encoding: .utf8), text.contains("\"notes\"") {
                ok = true
            }
            gate.signal()
        }.resume()
        _ = gate.wait(timeout: .now() + 2)
        return ok
    }

    private func ensureServer() -> Bool {
        for candidate in [3001, 3000] where mindBookPort(candidate) {
            port = candidate
            return true
        }
        port = 3001
        guard startServer() else { return false }
        let deadline = Date().addingTimeInterval(45)
        while Date() < deadline {
            if mindBookPort(port) { return true }
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
        proc.arguments = [next, "dev", "--port", String(port)]
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

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        webView.window?.makeFirstResponder(webView)
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
