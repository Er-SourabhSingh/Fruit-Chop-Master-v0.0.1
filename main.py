import pygame

from game_manager import FPS, SCREEN_HEIGHT, SCREEN_WIDTH, GameManager

MIN_WINDOW_WIDTH = 640
MIN_WINDOW_HEIGHT = 360


def main() -> None:
    # Lower audio buffer size helps keep slice/bomb sounds responsive.
    pygame.mixer.pre_init(44100, -16, 2, 512)
    pygame.init()

    screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT), pygame.RESIZABLE)
    pygame.display.set_caption("Fruit Slice")
    clock = pygame.time.Clock()

    game_manager = GameManager(screen)
    running = True
    is_minimized = False

    while running:
        dt = clock.tick(FPS) / 1000.0
        events = pygame.event.get()

        for event in events:
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.WINDOWCLOSE:
                running = False
            elif event.type == pygame.WINDOWMINIMIZED:
                is_minimized = True
            elif event.type == pygame.WINDOWRESTORED:
                is_minimized = False
                current_surface = pygame.display.get_surface()
                if current_surface is not None:
                    screen = current_surface
                    game_manager.resize(screen)
            elif event.type == pygame.VIDEORESIZE:
                if event.w <= 0 or event.h <= 0:
                    is_minimized = True
                    continue

                is_minimized = False
                new_width = max(MIN_WINDOW_WIDTH, event.w)
                new_height = max(MIN_WINDOW_HEIGHT, event.h)
                screen = pygame.display.set_mode((new_width, new_height), pygame.RESIZABLE)
                game_manager.resize(screen)
            elif event.type in (pygame.WINDOWSIZECHANGED, pygame.WINDOWRESIZED):
                # Do not recreate the window here; just sync manager to OS-applied size.
                current_surface = pygame.display.get_surface()
                if current_surface is None:
                    continue
                current_width, current_height = current_surface.get_size()
                if current_width <= 0 or current_height <= 0:
                    is_minimized = True
                    continue
                is_minimized = False
                screen = current_surface
                game_manager.resize(screen)

        game_manager.handle_events(events)
        if is_minimized:
            continue

        game_manager.update(dt)
        game_manager.draw()
        pygame.display.flip()

    pygame.quit()


if __name__ == "__main__":
    main()
