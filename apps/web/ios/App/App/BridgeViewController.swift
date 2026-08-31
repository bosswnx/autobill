import Capacitor
import UIKit

class BridgeViewController: CAPBridgeViewController {
  override func viewDidLoad() {
    super.viewDidLoad()
    webView?.allowsBackForwardNavigationGestures = true
    webView?.allowsLinkPreview = false
    webView?.scrollView.contentInsetAdjustmentBehavior = .never
    webView?.scrollView.bounces = true
    webView?.scrollView.alwaysBounceVertical = true
    webView?.scrollView.alwaysBounceHorizontal = false
    webView?.backgroundColor = .white
    view.backgroundColor = .white
  }
}
