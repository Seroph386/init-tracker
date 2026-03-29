import AppKit
import Foundation
import WebKit

enum ScreenshotError: Error {
    case snapshotFailed
    case pngEncodingFailed
}

final class PageCapture: NSObject, WKNavigationDelegate {
    private let url: URL
    private let size: CGSize
    private let dataStore: WKWebsiteDataStore
    private let onLoad: ((WKWebView, @escaping (Error?) -> Void) -> Void)?
    private let onImage: (Result<NSImage, Error>) -> Void
    private let webView: WKWebView
    private var didPrepare = false

    init(
        url: URL,
        size: CGSize,
        dataStore: WKWebsiteDataStore,
        onLoad: ((WKWebView, @escaping (Error?) -> Void) -> Void)? = nil,
        onImage: @escaping (Result<NSImage, Error>) -> Void
    ) {
        self.url = url
        self.size = size
        self.dataStore = dataStore
        self.onLoad = onLoad
        self.onImage = onImage

        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = dataStore
        self.webView = WKWebView(frame: CGRect(origin: .zero, size: size), configuration: configuration)

        super.init()
        self.webView.navigationDelegate = self
    }

    func start() {
        webView.load(URLRequest(url: url))
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard !didPrepare else { return }
        didPrepare = true

        let prepareAndCapture = {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
                let config = WKSnapshotConfiguration()
                config.rect = CGRect(origin: .zero, size: self.size)
                webView.takeSnapshot(with: config) { image, error in
                    if let error {
                        self.onImage(.failure(error))
                        return
                    }

                    guard let image else {
                        self.onImage(.failure(ScreenshotError.snapshotFailed))
                        return
                    }

                    self.onImage(.success(image))
                }
            }
        }

        guard let onLoad else {
            prepareAndCapture()
            return
        }

        onLoad(webView) { error in
            if let error {
                self.onImage(.failure(error))
                return
            }

            prepareAndCapture()
        }
    }
}

final class DMCapture: NSObject, WKNavigationDelegate {
    private let url: URL
    private let size: CGSize
    private let dataStore: WKWebsiteDataStore
    private let onImage: (Result<NSImage, Error>) -> Void
    private let webView: WKWebView
    private var stage = 0

    init(
        url: URL,
        size: CGSize,
        dataStore: WKWebsiteDataStore,
        onImage: @escaping (Result<NSImage, Error>) -> Void
    ) {
        self.url = url
        self.size = size
        self.dataStore = dataStore
        self.onImage = onImage

        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = dataStore
        self.webView = WKWebView(frame: CGRect(origin: .zero, size: size), configuration: configuration)

        super.init()
        self.webView.navigationDelegate = self
    }

    func start() {
        webView.load(URLRequest(url: url))
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        switch stage {
        case 0:
            stage = 1
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
                let config = WKSnapshotConfiguration()
                config.rect = CGRect(origin: .zero, size: self.size)
                webView.takeSnapshot(with: config) { image, snapshotError in
                    if let snapshotError {
                        self.onImage(.failure(snapshotError))
                        return
                    }

                    guard let image else {
                        self.onImage(.failure(ScreenshotError.snapshotFailed))
                        return
                    }

                    self.onImage(.success(image))
                }
            }
        default:
            break
        }
    }
}

final class ScreenshotCoordinator {
    private let baseURL = URL(string: "http://127.0.0.1:4173/init-tracker/")!
    private let docsDirectory: URL
    private let dataStore = WKWebsiteDataStore.default()
    private let splitSize = CGSize(width: 1600, height: 900)
    private let onDeckSize = CGSize(width: 1600, height: 900)
    private let finish: (Result<Void, Error>) -> Void

    init(docsDirectory: URL, finish: @escaping (Result<Void, Error>) -> Void) {
        self.docsDirectory = docsDirectory
        self.finish = finish
    }

    func start() {
        captureDM()
    }

    private func captureDM() {
        let capture = DMCapture(
            url: baseURL.appending(queryItems: [URLQueryItem(name: "docs-demo", value: "readme")]),
            size: splitSize,
            dataStore: dataStore
        ) { result in
            switch result {
            case .success(let dmImage):
                self.capturePlayer(dmImage: dmImage)
            case .failure(let error):
                self.finish(.failure(error))
            }
        }

        capture.start()
        retain(capture)
    }

    private func capturePlayer(dmImage: NSImage) {
        let capture = PageCapture(
            url: baseURL.appending(queryItems: [
                URLQueryItem(name: "view", value: "player"),
                URLQueryItem(name: "docs-demo", value: "readme")
            ]),
            size: splitSize,
            dataStore: dataStore
        ) { result in
            switch result {
            case .success(let playerImage):
                do {
                    try self.write(image: dmImage, to: self.docsDirectory.appendingPathComponent("dm-view.png"))
                    try self.write(image: playerImage, to: self.docsDirectory.appendingPathComponent("player-view.png"))
                    self.captureOnDeck()
                } catch {
                    self.finish(.failure(error))
                }
            case .failure(let error):
                self.finish(.failure(error))
            }
        }

        capture.start()
        retain(capture)
    }

    private func captureOnDeck() {
        let capture = PageCapture(
            url: baseURL.appending(queryItems: [
                URLQueryItem(name: "view", value: "on-deck"),
                URLQueryItem(name: "docs-demo", value: "readme")
            ]),
            size: onDeckSize,
            dataStore: dataStore
        ) { result in
            switch result {
            case .success(let image):
                do {
                    try self.write(image: image, to: self.docsDirectory.appendingPathComponent("on-deck-view.png"))
                    self.finish(.success(()))
                } catch {
                    self.finish(.failure(error))
                }
            case .failure(let error):
                self.finish(.failure(error))
            }
        }

        capture.start()
        retain(capture)
    }

    private func write(image: NSImage, to url: URL) throws {
        guard
            let tiff = image.tiffRepresentation,
            let bitmap = NSBitmapImageRep(data: tiff),
            let data = bitmap.representation(using: .png, properties: [:])
        else {
            throw ScreenshotError.pngEncodingFailed
        }

        try data.write(to: url)
    }

    private func retain(_ object: AnyObject) {
        retainedObjects.append(object)
    }

    private var retainedObjects: [AnyObject] = []
}

private extension URL {
    func appending(queryItems: [URLQueryItem]) -> URL {
        var components = URLComponents(url: self, resolvingAgainstBaseURL: false)!
        components.queryItems = queryItems
        return components.url!
    }
}

let rootDirectory = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let docsDirectory = rootDirectory.appendingPathComponent("docs", isDirectory: true)
var isFinished = false

DispatchQueue.main.async {
    let coordinator = ScreenshotCoordinator(docsDirectory: docsDirectory) { result in
        switch result {
        case .success:
            print("Saved docs/dm-view.png, docs/player-view.png, and docs/on-deck-view.png")
        case .failure(let error):
            fputs("Failed to generate screenshots: \(error)\n", stderr)
            exitCode = 1
        }

        isFinished = true
    }

    coordinator.start()
    retainedCoordinator = coordinator
}

var retainedCoordinator: ScreenshotCoordinator?
var exitCode: Int32 = 0

while !isFinished {
    RunLoop.main.run(mode: .default, before: Date(timeIntervalSinceNow: 0.1))
}

exit(exitCode)
