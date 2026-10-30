# Interface design tokens

Use these semantic CSS variables instead of adding another hard-coded page, card, border, or text color. Every selectable theme maps the same roles to its own palette.

| Token | Purpose |
| --- | --- |
| `--ui-page` | Page and workspace background |
| `--ui-surface` | Cards, dialogs, and primary panels |
| `--ui-raised` | Secondary controls and inset panels |
| `--ui-border` | Standard card and control border |
| `--ui-text` | Primary readable text |
| `--ui-muted` | Supporting labels and descriptions |
| `--ui-accent` | Focus, active controls, and primary actions |
| `--ui-card-shadow` | Shared card depth |

Use `.notion-card` for general dashboard cards and `.analytics-card` for analytics sections. Both consume these tokens, so borders and depth remain consistent across Default, Terminal, Premium Journal, Modern Platform, Ocean, and Graphite.
