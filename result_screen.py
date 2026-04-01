from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import pygame


@dataclass
class ResultScreenModel:
    mode_label: str
    title: str
    outcome_text: str
    winner: str
    human_score: int
    ai_score: Optional[int]
    high_score: int
    new_high_score: bool


class ResultScreen:
    def __init__(self) -> None:
        self.restart_button = pygame.Rect(0, 0, 0, 0)
        self.menu_button = pygame.Rect(0, 0, 0, 0)

    def draw(
        self,
        surface: pygame.Surface,
        model: ResultScreenModel,
        title_font: pygame.font.Font,
        heading_font: pygame.font.Font,
        body_font: pygame.font.Font,
        ui_font: pygame.font.Font,
    ) -> None:
        width, height = surface.get_size()

        overlay = pygame.Surface((width, height), pygame.SRCALPHA)
        overlay.fill((0, 0, 0, 178))
        surface.blit(overlay, (0, 0))

        card_width = min(int(width * 0.78), 760)
        card_height = min(int(height * 0.72), 540)
        card_rect = pygame.Rect(0, 0, card_width, card_height)
        card_rect.center = (width // 2, height // 2)

        winner_border = self._winner_color(model.winner)
        pygame.draw.rect(surface, (18, 22, 34), card_rect, border_radius=18)
        pygame.draw.rect(surface, winner_border, card_rect, width=3, border_radius=18)

        y = card_rect.top + max(20, int(card_rect.height * 0.06))
        mode_surface = ui_font.render(model.mode_label, True, (185, 210, 245))
        mode_rect = mode_surface.get_rect(center=(card_rect.centerx, y))
        surface.blit(mode_surface, mode_rect)

        y += max(42, int(card_rect.height * 0.10))
        title_surface = title_font.render(model.title, True, (245, 245, 245))
        title_rect = title_surface.get_rect(center=(card_rect.centerx, y))
        surface.blit(title_surface, title_rect)

        y += max(42, int(card_rect.height * 0.10))
        outcome_surface = heading_font.render(model.outcome_text, True, winner_border)
        outcome_rect = outcome_surface.get_rect(center=(card_rect.centerx, y))
        surface.blit(outcome_surface, outcome_rect)

        y += max(56, int(card_rect.height * 0.12))
        human_color = (255, 233, 126) if model.winner == "human" else (235, 235, 235)
        human_score_surface = heading_font.render(f"Human: {model.human_score}", True, human_color)
        human_score_rect = human_score_surface.get_rect(center=(card_rect.centerx, y))
        surface.blit(human_score_surface, human_score_rect)

        if model.ai_score is not None:
            y += max(42, int(card_rect.height * 0.09))
            ai_color = (125, 196, 255) if model.winner == "ai" else (225, 235, 248)
            ai_score_surface = heading_font.render(f"AI: {model.ai_score}", True, ai_color)
            ai_score_rect = ai_score_surface.get_rect(center=(card_rect.centerx, y))
            surface.blit(ai_score_surface, ai_score_rect)

        y += max(46, int(card_rect.height * 0.10))
        high_surface = body_font.render(f"High Score: {model.high_score}", True, (248, 220, 120))
        high_rect = high_surface.get_rect(center=(card_rect.centerx, y))
        surface.blit(high_surface, high_rect)

        if model.new_high_score:
            y += max(32, int(card_rect.height * 0.07))
            new_high_surface = body_font.render("New High Score!", True, (255, 244, 125))
            new_high_rect = new_high_surface.get_rect(center=(card_rect.centerx, y))
            surface.blit(new_high_surface, new_high_rect)

        button_width = max(180, int(card_rect.width * 0.32))
        button_height = max(44, int(card_rect.height * 0.12))
        gap = max(22, int(card_rect.width * 0.04))
        total_width = (button_width * 2) + gap
        left_x = card_rect.centerx - (total_width // 2)
        button_y = card_rect.bottom - max(84, int(card_rect.height * 0.16))

        self.restart_button = pygame.Rect(left_x, button_y, button_width, button_height)
        self.menu_button = pygame.Rect(left_x + button_width + gap, button_y, button_width, button_height)

        self._draw_button(surface, self.restart_button, "Restart", (58, 162, 88), body_font)
        self._draw_button(surface, self.menu_button, "Back To Menu", (70, 105, 168), body_font)

    def clicked_action(self, mouse_pos: tuple[int, int]) -> Optional[str]:
        if self.restart_button.collidepoint(mouse_pos):
            return "restart"
        if self.menu_button.collidepoint(mouse_pos):
            return "menu"
        return None

    @staticmethod
    def _winner_color(winner: str) -> tuple[int, int, int]:
        if winner == "human":
            return (248, 232, 102)
        if winner == "ai":
            return (120, 185, 255)
        if winner == "draw":
            return (210, 210, 210)
        return (235, 235, 235)

    @staticmethod
    def _draw_button(
        surface: pygame.Surface,
        rect: pygame.Rect,
        label: str,
        color: tuple[int, int, int],
        font: pygame.font.Font,
    ) -> None:
        pygame.draw.rect(surface, color, rect, border_radius=10)
        pygame.draw.rect(surface, (246, 246, 246), rect, width=2, border_radius=10)
        text_surface = font.render(label, True, (252, 252, 252))
        text_rect = text_surface.get_rect(center=rect.center)
        surface.blit(text_surface, text_rect)
