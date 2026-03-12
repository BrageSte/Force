FINGER_NAMES = ["Index", "Middle", "Ring", "Pinky"]
FINGER_COLORS = ["#e04f5f", "#0b84f3", "#15a15d", "#f0a31a"]
TOTAL_COLOR = "#1f3d69"


def display_order(hand: str) -> list[int]:
    return [0, 1, 2, 3] if hand == "Right" else [3, 2, 1, 0]
