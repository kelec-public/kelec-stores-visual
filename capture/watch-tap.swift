// Touche l'écran de la montre dans la fenêtre Device Hub (macOS, permission Accessibilité requise).
//   watch-tap <x> <y>   coordonnées dans la capture de la montre (422×514 pour l'Ultra)
// La fenêtre garde sa taille et son zoom : la montre y est à l'échelle 0,4527 pt par pixel d'écran.
import Cocoa

let a = CommandLine.arguments
guard a.count == 3, let sx = Double(a[1]), let sy = Double(a[2]) else { print("usage: watch-tap x y"); exit(2) }
guard AXIsProcessTrusted() else { print("Permission Accessibilité manquante"); exit(3) }
let wins = CGWindowListCopyWindowInfo(.optionOnScreenOnly, kCGNullWindowID) as! [[String: Any]]
guard let w = wins.first(where: { ($0["kCGWindowOwnerName"] as? String) == "Device Hub" && ($0["kCGWindowName"] as? String ?? "").contains("Watch") }),
      let b = w["kCGWindowBounds"] as? [String: Double] else { print("Fenêtre Device Hub de la montre introuvable"); exit(4) }
// Calibré sur le bouton carte (340, 412) = (fenêtre + 680, fenêtre + 701) pt.
let k = 0.4527
let p = CGPoint(x: b["X"]! + 680 + (sx - 340) * k, y: b["Y"]! + 701 + (sy - 412) * k)
func ev(_ t: CGEventType) { CGEvent(mouseEventSource: nil, mouseType: t, mouseCursorPosition: p, mouseButton: .left)!.post(tap: .cghidEventTap) }
ev(.mouseMoved); usleep(150_000); ev(.leftMouseDown); usleep(120_000); ev(.leftMouseUp)
