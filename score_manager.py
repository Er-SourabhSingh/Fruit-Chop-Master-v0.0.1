class ScoreManager:
    @staticmethod
    def combo_bonus_for_hits(sliced_in_swipe: int) -> int:
        if sliced_in_swipe == 2:
            return 1
        if sliced_in_swipe == 3:
            return 2
        if sliced_in_swipe == 4:
            return 4
        if sliced_in_swipe > 4:
            return 4 + ((sliced_in_swipe - 4) * 2)
        return 0

    @staticmethod
    def human_combo_text(sliced_in_swipe: int, bonus: int) -> str:
        if sliced_in_swipe == 2:
            return f"Combo x2  +{bonus}"
        if sliced_in_swipe == 3:
            return f"Great Slice! Combo x3  +{bonus}"
        if sliced_in_swipe == 4:
            return f"Awesome Combo! x4  +{bonus}"
        return f"Legendary Combo x{sliced_in_swipe}  +{bonus}"

    @staticmethod
    def ai_combo_text(sliced_in_swipe: int, bonus: int) -> str:
        if sliced_in_swipe == 2:
            return f"AI Combo x2  +{bonus}"
        if sliced_in_swipe == 3:
            return f"AI Great Slice! x3  +{bonus}"
        if sliced_in_swipe == 4:
            return f"AI Awesome Combo! x4  +{bonus}"
        return f"AI Legendary Combo x{sliced_in_swipe}  +{bonus}"
