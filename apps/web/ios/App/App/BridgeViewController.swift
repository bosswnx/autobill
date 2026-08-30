import Capacitor
import UIKit

class BridgeViewController: CAPBridgeViewController {
  override func viewDidLoad() {
    super.viewDidLoad()
    webView?.allowsBackForwardNavigationGestures = true
    webView?.scrollView.contentInsetAdjustmentBehavior = .never
    webView?.backgroundColor = .white
    view.backgroundColor = .white
  }
}
